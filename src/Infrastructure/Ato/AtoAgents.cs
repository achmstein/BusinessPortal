using System.Net;
using System.Text.Json;

namespace BusinessPortal.Infrastructure.Ato;

/// <summary>"OnAuthenticated" — post-auth REST headers + agent-list loading. C# port of
/// lib/ato/agents.ts. Derives the AtoCsrfHeader from the AtoAuthenticationSessionId
/// cookie, then walks SessionView → UPN → RelatedParties(ABN) → RelatedParties(RAN).</summary>
public static class AtoAgents
{
    /// <summary>Build the REST-API headers required after auth from the current cookie
    /// jar. Throws if the session cookie isn't present (auth didn't complete).</summary>
    public static Dictionary<string, string> BuildAuthenticatedHeaders(CookieContainer jar)
    {
        var cookies = jar.GetCookies(new Uri(AtoConstants.AtoOnlineOrigin));
        var sessionCookie = cookies[AtoConstants.AtoSessionCookieName];
        if (sessionCookie is null || string.IsNullOrEmpty(sessionCookie.Value))
            throw new MissingJsonField(AtoConstants.AtoOnlineOrigin, AtoConstants.AtoSessionCookieName);

        return new Dictionary<string, string>
        {
            [AtoConstants.HdrAtoCsrfHeader] = sessionCookie.Value,
            [AtoConstants.HdrAtoIsfProxyRoute] = "REST",
            [AtoConstants.HdrApplicationDetails] = AtoConstants.ApplicationDetailsValue,
        };
    }

    /// <summary>Walk SessionView → UPN → RelatedParties (ABN/RA) → RAN to build the agent
    /// list. Mirrors the original loadAgents / Taxtron's GetAgentsAsync.</summary>
    public static async Task<List<AtoAgent>> LoadAgentsAsync(AtoHttp http, CancellationToken ct = default)
    {
        var authHeaders = BuildAuthenticatedHeaders(http.Jar);
        // SessionView wants the AJAX header alongside the REST headers.
        var baseHeaders = new Dictionary<string, string>(authHeaders)
        {
            [AtoConstants.HdrRequestedWith] = AtoConstants.RequestedWith,
        };

        // 1. SessionView → UPN
        using var sessionView = await http.SendAsync(AtoConstants.SessionView, HttpMethod.Get, headers: baseHeaders, ct: ct);
        var sessionJson = await AtoHttp.ParseJsonOrThrowAsync(sessionView, AtoConstants.SessionView, ct);
        var upn = ExtractUpn(sessionJson)
            ?? throw new MissingJsonField(AtoConstants.SessionView, "response.ExternalIdentifiers.UPN[0]");

        // 2. /Identifiers/{upn}/RelatedParties → list of {name, abn}
        var identifiersUrl = AtoConstants.IdentifiersRelatedPartiesUrl(upn);
        using var partiesResp = await http.SendAsync(identifiersUrl, HttpMethod.Get, headers: baseHeaders, ct: ct);
        var partiesJson = await AtoHttp.ParseJsonOrThrowAsync(partiesResp, identifiersUrl, ct);

        var agents = new List<AtoAgent>();

        // 3. For each ABN → /ABN/{abn}/RelatedParties → first RAN
        foreach (var party in EnumerateRelatedParties(partiesJson))
        {
            var name = StringLoose(party, "unstructuredFullName")?.Trim();
            var abn = StringLoose(party, "clientIdentifierValueID")?.Trim();
            if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(abn)) continue;

            var ranUrl = AtoConstants.AbnRelatedPartiesUrl(abn);
            using var ranResp = await http.SendAsync(ranUrl, HttpMethod.Get, headers: baseHeaders, ct: ct);
            if (!ranResp.IsSuccessStatusCode) continue;

            var ranJson = await AtoHttp.ParseJsonOrThrowAsync(ranResp, ranUrl, ct);
            var ran = FirstRelatedPartyIdentifier(ranJson);
            if (string.IsNullOrEmpty(ran)) continue;

            agents.Add(new AtoAgent(name, abn, ran));
        }

        return agents;
    }

    // ─── JSON helpers (ATO responses type-shift string↔number, so read loosely) ───

    private static bool TryProp(JsonElement el, string name, out JsonElement child)
    {
        if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(name, out child))
            return true;
        child = default;
        return false;
    }

    /// <summary>Read a property as a string whether the JSON value is a string or a number
    /// (ATO returns identifier values as either, depending on Application-Details).</summary>
    private static string? StringLoose(JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v)
            ? v.ValueKind switch
            {
                JsonValueKind.String => v.GetString(),
                JsonValueKind.Number => v.GetRawText(),
                _ => null,
            }
            : null;

    private static string? ExtractUpn(JsonElement json)
    {
        if (TryProp(json, "response", out var r)
            && TryProp(r, "ExternalIdentifiers", out var ei)
            && TryProp(ei, "UPN", out var upn)
            && upn.ValueKind == JsonValueKind.Array
            && upn.GetArrayLength() > 0)
        {
            var first = upn[0];
            return first.ValueKind switch
            {
                JsonValueKind.String => first.GetString(),
                JsonValueKind.Number => first.GetRawText(),
                _ => null,
            };
        }
        return null;
    }

    private static IEnumerable<JsonElement> EnumerateRelatedParties(JsonElement json)
    {
        if (TryProp(json, "response", out var r)
            && TryProp(r, "relatedParties", out var rp)
            && rp.ValueKind == JsonValueKind.Array)
        {
            foreach (var p in rp.EnumerateArray()) yield return p;
        }
    }

    private static string? FirstRelatedPartyIdentifier(JsonElement json)
    {
        if (TryProp(json, "response", out var r)
            && TryProp(r, "relatedParties", out var rp)
            && rp.ValueKind == JsonValueKind.Array
            && rp.GetArrayLength() > 0)
        {
            return StringLoose(rp[0], "clientIdentifierValueID");
        }
        return null;
    }
}
