using System.Net;
using System.Text;
using System.Text.Json;

namespace BusinessPortal.Infrastructure.Ato;

/// <summary>An agent as returned by the AgentLinks search — enough to feed straight back
/// into the nomination POST.</summary>
public record AtoAgentSummary(string TaxAgentNumber, string? ClientAccountId, string? Name, string? Abn);

public record NominationLookupResult(string Ran, string Name, AtoAgentSummary Agent);

public enum NominationStatus { Submitted, AlreadyNominated }

public record NominationSubmitResult(NominationStatus Status, string? NominationId, string? Message);

/// <summary>Agent-nomination flow against Online services for Business — C# port of
/// lib/ato/nominate.ts. Endpoints + body shape reverse-engineered from a real HAR
/// (2026-06-29): search the agent by RAN scoped to the nominating ABN (returns 206), then
/// POST the nomination. Uses a DIFFERENT Application-Details from the rest of the REST API
/// (LinkedAgents#Nominate, not ClientSummary) — do not swap it. UNVERIFIED here — needs a
/// live authenticated myID session.</summary>
public static class AtoNominate
{
    private const string NominationAppDetails =
        "CodeValues=true,softwareProductName=ATOOnline_LinkedAgents#Nominate,softwareProductVersion=1,softwareOrganisationName=ATO";
    private const string NominationAppDetailsSearch =
        "CodeValues=false,softwareProductName=ATOOnline_LinkedAgents#Nominate,softwareProductVersion=1,softwareOrganisationName=ATO";

    /// <summary>Search for an agent by RAN, scoped to the nominating ABN. Returns the first
    /// match so the UI can confirm "You're about to nominate {Name}" before submit.</summary>
    public static async Task<NominationLookupResult> LookupAgentByRanAsync(
        AtoHttp http, string ran, string nominatingAbn, CancellationToken ct = default)
    {
        // Filter/Context are single-quoted literals then URL-encoded. The trailing space
        // inside "searchTermText={ran} " is observed in the HAR — preserve it.
        var filter = Uri.EscapeDataString($"'searchTermText={ran} '");
        var context = Uri.EscapeDataString($"'ABN={nominatingAbn}'");
        var url = $"{AtoConstants.AtoOnlineOrigin}/api/v1/Clients/ABN/{nominatingAbn}/AgentLinks?Filter={filter}&Context={context}";
        var headers = BuildHeaders(http.Jar, NominationAppDetailsSearch, range: "items=0-999");

        using var resp = await http.SendAsync(url, HttpMethod.Get, headers: headers, ct: ct);
        // 206 (Partial Content) is normal for this paginated endpoint (IsSuccessStatusCode).
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            throw new AtoChainError("nominate.lookup", $"Agent lookup HTTP {(int)resp.StatusCode}. Body: {Trunc(body, 500)}");
        }

        var json = await AtoHttp.ParseJsonOrThrowAsync(resp, url, ct);
        var summaries = AtoJson.ArrayProp(AtoJson.Response(json), "agentSummariesList").ToList();

        var match = summaries.FirstOrDefault(a => AtoJson.StringLoose(a, "taxAgentNumber") == ran);
        if (match.ValueKind == JsonValueKind.Undefined)
            match = summaries.Count > 0 ? summaries[0] : default;
        if (match.ValueKind == JsonValueKind.Undefined)
            throw new AtoChainError("nominate.lookup",
                $"No agent found for RAN {ran}. Check the RAN and that the agent operates in your jurisdiction.");

        var name = AtoJson.StringLoose(match, "unstructuredFullName");
        if (string.IsNullOrEmpty(name))
            throw new MissingJsonField(url, "agentSummariesList[0].unstructuredFullName");

        var agent = new AtoAgentSummary(
            AtoJson.StringLoose(match, "taxAgentNumber") ?? ran,
            AtoJson.StringLoose(match, "clientAccountID"),
            name,
            AtoJson.StringLoose(match, "clientIdentifierAustralianBusinessNumber"));

        return new NominationLookupResult(ran, name, agent);
    }

    /// <summary>Submit the nomination using the AgentSummary from <see cref="LookupAgentByRanAsync"/>.</summary>
    public static async Task<NominationSubmitResult> NominateAgentAsync(
        AtoHttp http, AtoAgentSummary agent, string nominatingAbn, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(agent.ClientAccountId))
            throw new MissingJsonField("nominate.submit", "agent.clientAccountID");

        var context = Uri.EscapeDataString($"'ABN={nominatingAbn}'");
        var url = $"{AtoConstants.AtoOnlineOrigin}/api/v1/Clients/ABN/{nominatingAbn}/AgentLinks/Nominations?Context={context}";
        var headers = BuildHeaders(http.Jar, NominationAppDetails);

        // Body shape from a real OSfB nomination HAR. No declarationAccepted on the wire —
        // clicking Submit IS the declaration. Field names come straight from the capture.
        var body = new StringContent(JsonSerializer.Serialize(new
        {
            nominatedIdentifierValueID = agent.TaxAgentNumber,
            nominatedIdentifierTypeCode = "TAN",
            nominatedAccountId = agent.ClientAccountId,
            nominationTypeCode = "001",
            clientLinkStartDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            inputModeCode = "A",
        }), Encoding.UTF8, "application/json");

        using var resp = await http.SendAsync(url, HttpMethod.Post, body, headers, ct);
        if (!resp.IsSuccessStatusCode)
        {
            var text = await resp.Content.ReadAsStringAsync(ct);
            throw new AtoChainError("nominate.submit", $"Submit HTTP {(int)resp.StatusCode}. Body: {Trunc(text, 1000)}");
        }

        // The response may be JSON or (during maintenance) HTML — tolerate both.
        JsonElement root = default;
        try
        {
            var parsed = await AtoHttp.ParseJsonOrThrowAsync(resp, url, ct);
            root = AtoJson.TryProp(parsed, "response", out var r) ? r : parsed;
        }
        catch (AtoReturnedHtml) { /* treat as submitted without a body */ }

        var status = root.ValueKind == JsonValueKind.Object ? AtoJson.StringLoose(root, "status") : null;
        return new NominationSubmitResult(
            status == "AlreadyNominated" ? NominationStatus.AlreadyNominated : NominationStatus.Submitted,
            root.ValueKind == JsonValueKind.Object ? AtoJson.StringLoose(root, "id") : null,
            root.ValueKind == JsonValueKind.Object ? AtoJson.StringLoose(root, "message") : null);
    }

    private static Dictionary<string, string> BuildHeaders(CookieContainer jar, string appDetails, string? range = null)
    {
        var session = jar.GetCookies(new Uri(AtoConstants.AtoOnlineOrigin))[AtoConstants.AtoSessionCookieName];
        if (session is null || string.IsNullOrEmpty(session.Value))
            throw new MissingJsonField(AtoConstants.AtoOnlineOrigin, AtoConstants.AtoSessionCookieName);

        var h = new Dictionary<string, string>
        {
            ["Accept"] = "application/json; version=1",
            [AtoConstants.HdrAtoCsrfHeader] = session.Value,
            [AtoConstants.HdrAtoIsfProxyRoute] = "REST",
            [AtoConstants.HdrApplicationDetails] = appDetails,
            [AtoConstants.HdrRequestedWith] = "XMLHttpRequest",
            ["Referer"] = $"{AtoConstants.AtoOnlineOrigin}/Business/Agentdetails",
        };
        if (range is not null) h["Range"] = range;
        return h;
    }

    private static string Trunc(string s, int max) =>
        string.IsNullOrEmpty(s) ? "" : s.Length <= max ? s : s[..max] + "...[truncated]";
}
