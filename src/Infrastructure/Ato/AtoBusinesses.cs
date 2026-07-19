using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.Ato;

/// <summary>One business the authenticated user can act for, flattened to the fields we
/// persist into the client's entity list. C# port of lib/ato/businesses.ts.</summary>
public record AtoBusinessDetail(
    string Abn,
    string DisplayName,
    string? LegalName,
    IReadOnlyList<string> TradingNames,
    int? EntityTypeCode,
    string? EntityTypeName,
    string? Acn,
    string? Tfn,
    string? ClientAccountId);

/// <summary>Pull "businesses I can act for" + their detail records from Online services for
/// Business (OSfB). Each OSfB screen uses a DIFFERENT Application-Details value and the
/// browser-like Sec-* / Sec-Ch-Ua-* headers are load-bearing for Akamai BotManager (without
/// them the list call returns PRX-019). Values captured from a real HAR — do not "tidy".
/// UNVERIFIED here — needs a live authenticated myID session to exercise.</summary>
public static class AtoBusinesses
{
    // App-Details captured from a real /Business/ContextSelection HAR. "#Loader" for the
    // initial list call; "#ContextSelection" for every per-ABN detail call after it.
    private const string AppDetailsSelectorLoader =
        "CodeValues=true,softwareProductName=ATOOnline_ContextSelection#Loader,softwareProductVersion=1,softwareOrganisationName=ATO";
    private const string AppDetailsContextSelection =
        "CodeValues=true,softwareProductName=ATOOnline_ContextSelection#ContextSelection,softwareProductVersion=1,softwareOrganisationName=ATO";

    // Identifier / name / client type codes (Number()-coerced before comparing — ATO
    // returns them as strings in some modes, numbers in others).
    private const int IdentifierTypeTfn = 5;   // 9-digit TFN
    private const int NameTypeLegal = 5;
    private const int NameTypeTrading = 55;
    private const int ClientTypeCompany = 20;

    /// <summary>Orchestrator: list every business the user can act for → fetch each one's
    /// detail concurrently → return. One slow/failing ABN doesn't drop the rest.
    /// <paramref name="seedAbns"/> is a last-resort fallback if the list call breaks.</summary>
    public static async Task<List<AtoBusinessDetail>> PullAllAsync(
        AtoHttp http, IEnumerable<string>? seedAbns = null, ILogger? logger = null, CancellationToken ct = default)
    {
        List<(string Abn, string? Name)> entries = [];
        try
        {
            var upn = await FetchUpnAsync(http, ct);
            entries = await ListBusinessesAsync(http, upn, ct);
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "ATO listBusinesses failed — falling back to seed ABNs");
        }

        var abns = entries
            .Select(e => (Abn: ToAbn(e.Abn), e.Name))
            .Where(e => e.Abn is not null)
            .Select(e => (e.Abn!, e.Name))
            .ToList();

        if (abns.Count == 0 && seedAbns is not null)
            abns = seedAbns.Select(ToAbn).Where(a => a is not null).Select(a => (a!, (string?)null)).ToList();

        var tasks = abns.Select(async e =>
        {
            try { return await FetchBusinessDetailAsync(http, e.Item1, e.Name, ct); }
            catch (Exception ex) { logger?.LogWarning(ex, "ATO fetch detail failed for {Abn}", e.Item1); return null; }
        });
        var results = await Task.WhenAll(tasks);
        return results.Where(r => r is not null).Select(r => r!).ToList();
    }

    /// <summary>SessionView UPN — used by <see cref="ListBusinessesAsync"/>.</summary>
    public static async Task<string> FetchUpnAsync(AtoHttp http, CancellationToken ct = default)
    {
        var headers = BuildHeaders(http.Jar, AppDetailsContextSelection, referer: $"{AtoConstants.AtoOnlineOrigin}/Business/");
        using var resp = await http.SendAsync(AtoConstants.SessionView, HttpMethod.Get, headers: headers, ct: ct);
        if (!resp.IsSuccessStatusCode)
            throw new AtoChainError("businesses.sessionView", $"HTTP {(int)resp.StatusCode}");
        var json = await AtoHttp.ParseJsonOrThrowAsync(resp, AtoConstants.SessionView, ct);
        var response = AtoJson.Response(json);
        if (AtoJson.TryProp(response, "ExternalIdentifiers", out var ei)
            && AtoJson.TryProp(ei, "UPN", out var upn)
            && upn.ValueKind == JsonValueKind.Array && upn.GetArrayLength() > 0
            && AtoJson.Scalar(upn[0]) is { Length: > 0 } value)
            return value;
        throw new MissingJsonField(AtoConstants.SessionView, "response.ExternalIdentifiers.UPN[0]");
    }

    /// <summary>"Businesses I can act for" — the same list shown on the OSfB business selector.</summary>
    public static async Task<List<(string Abn, string? Name)>> ListBusinessesAsync(
        AtoHttp http, string? upn = null, CancellationToken ct = default)
    {
        var effectiveUpn = upn ?? await FetchUpnAsync(http, ct);
        var filter = Uri.EscapeDataString("'relationshipTypeDecode=ABN'");
        var url = $"{AtoConstants.AtoOnlineOrigin}/api/v2/Identifiers/{Uri.EscapeDataString(effectiveUpn)}/RelatedParties?Filter={filter}";
        var headers = BuildHeaders(http.Jar, AppDetailsSelectorLoader, range: "items=0-9999",
            referer: $"{AtoConstants.AtoOnlineOrigin}/Business/ContextSelection");

        using var resp = await http.SendAsync(url, HttpMethod.Get, headers: headers, ct: ct);
        if (!resp.IsSuccessStatusCode && (int)resp.StatusCode != 206)
            throw new AtoChainError("businesses.list", $"HTTP {(int)resp.StatusCode}");
        var json = await AtoHttp.ParseJsonOrThrowAsync(resp, url, ct);

        var result = new List<(string, string?)>();
        foreach (var p in AtoJson.ArrayProp(AtoJson.Response(json), "relatedParties"))
        {
            var typeCode = AtoJson.StringLoose(p, "clientIdentifierTypeCode");
            var value = AtoJson.StringLoose(p, "clientIdentifierValueID");
            if (typeCode == "ABN" && !string.IsNullOrEmpty(value))
                result.Add((value, AtoJson.StringLoose(p, "unstructuredFullName")));
        }
        return result;
    }

    /// <summary>Fetch all the detail we persist for one ABN — three concurrent GETs.</summary>
    public static async Task<AtoBusinessDetail> FetchBusinessDetailAsync(
        AtoHttp http, string abn, string? hintName = null, CancellationToken ct = default)
    {
        var detailsTask = FetchResponseAsync(http, $"{AtoConstants.AtoOnlineOrigin}/api/v1/Clients/ABN/{abn}/ClientDetails?Context={Ctx(abn)}", "businesses.clientDetails", abn, ct);
        var namesTask = FetchResponseAsync(http, $"{AtoConstants.AtoOnlineOrigin}/api/v1/Clients/ABN/{abn}/ClientNames?Context={Ctx(abn)}", "businesses.clientNames", abn, ct);
        var accountsTask = FetchAccountSummariesAsync(http, abn, ct);
        await Task.WhenAll(detailsTask, namesTask, accountsTask);
        var details = detailsTask.Result;
        var names = namesTask.Result;
        var accounts = accountsTask.Result;

        // TFN from clientIdentifiers (typeCode 5). Field name varies id / ID by response.
        string? tfn = null;
        foreach (var id in AtoJson.ArrayProp(details, "clientIdentifiers"))
        {
            if (AtoJson.IntLoose(id, "clientIdentifierTypeCode") == IdentifierTypeTfn)
            {
                tfn = AtoJson.StringLoose(id, "clientIdentifierValueId") ?? AtoJson.StringLoose(id, "clientIdentifierValueID");
                break;
            }
        }

        var clientType = AtoJson.IntLoose(details, "clientTypeCode");
        var isCompany = clientType == ClientTypeCompany;
        // ACN for companies = last 9 digits of the 11-digit ABN (Australian convention).
        var acn = isCompany && abn.Length == 11 ? abn[2..] : null;

        // Current legal name (typeCode 5, latest start date); trading names (typeCode 55).
        var legalCandidates = new List<(string Start, string Name)>();
        var tradingNames = new List<string>();
        foreach (var n in AtoJson.ArrayProp(names, "clientNames"))
        {
            var code = AtoJson.IntLoose(n, "clientNameTypeCode");
            var full = AtoJson.StringLoose(n, "unstructuredFullName");
            if (string.IsNullOrEmpty(full)) continue;
            if (code == NameTypeLegal) legalCandidates.Add((AtoJson.StringLoose(n, "clientNameStartDate") ?? "", full));
            else if (code == NameTypeTrading) tradingNames.Add(full);
        }
        var legalName = legalCandidates
            .OrderByDescending(x => x.Start, StringComparer.Ordinal)
            .Select(x => x.Name)
            .FirstOrDefault();

        // Income Tax account (clientAccountTypeCode 140) → clientAccountID for the nomination POST.
        var incomeTax = accounts.FirstOrDefault(a => AtoJson.StringLoose(a, "clientAccountTypeCode") == "140");
        var chosen = incomeTax.ValueKind != JsonValueKind.Undefined ? incomeTax
            : accounts.Count > 0 ? accounts[0] : default;
        var clientAccountId = chosen.ValueKind != JsonValueKind.Undefined ? AtoJson.StringLoose(chosen, "clientAccountID") : null;

        return new AtoBusinessDetail(
            abn,
            legalName ?? hintName ?? abn,
            legalName,
            tradingNames,
            clientType,
            isCompany ? "Company" : null,
            acn,
            tfn,
            clientAccountId);
    }

    private static async Task<JsonElement> FetchResponseAsync(AtoHttp http, string url, string stage, string abn, CancellationToken ct)
    {
        var headers = BuildHeaders(http.Jar, AppDetailsContextSelection);
        using var resp = await http.SendAsync(url, HttpMethod.Get, headers: headers, ct: ct);
        if (!resp.IsSuccessStatusCode)
            throw new AtoChainError(stage, $"HTTP {(int)resp.StatusCode} for ABN {abn}");
        var json = await AtoHttp.ParseJsonOrThrowAsync(resp, url, ct);
        return AtoJson.Response(json);
    }

    private static async Task<List<JsonElement>> FetchAccountSummariesAsync(AtoHttp http, string abn, CancellationToken ct)
    {
        var filter = Uri.EscapeDataString("'pagination.pageSizeNumber=250,pagination.recordStartNumber=1'");
        var url = $"{AtoConstants.AtoOnlineOrigin}/api/v1/Clients/ABN/{abn}/AccountSummaries?Filter={filter}&Context={Ctx(abn)}";
        var headers = BuildHeaders(http.Jar, AppDetailsContextSelection);
        using var resp = await http.SendAsync(url, HttpMethod.Get, headers: headers, ct: ct);
        if (!resp.IsSuccessStatusCode && (int)resp.StatusCode != 206)
            throw new AtoChainError("businesses.accountSummaries", $"HTTP {(int)resp.StatusCode}");
        var json = await AtoHttp.ParseJsonOrThrowAsync(resp, url, ct);
        var response = AtoJson.Response(json);
        // Field name varies by App-Details: clientAccountDetails vs accountSummaryDetails.
        var list = AtoJson.ArrayProp(response, "clientAccountDetails").ToList();
        if (list.Count == 0) list = AtoJson.ArrayProp(response, "accountSummaryDetails").ToList();
        return list;
    }

    private static string Ctx(string abn) => Uri.EscapeDataString($"'ABN={abn}'");

    /// <summary>Normalise an identifier (digits only) to an 11-digit ABN, or null.</summary>
    private static string? ToAbn(string? v)
    {
        if (string.IsNullOrEmpty(v)) return null;
        var s = new string(v.Where(char.IsDigit).ToArray());
        return s.Length == 11 ? s : null;
    }

    /// <summary>Common per-request browser-like headers used by every OSfB screen after auth.
    /// The Sec-Fetch-* / Sec-Ch-Ua-* / Accept-Language / Priority headers are load-bearing for
    /// the Akamai BotManager proxy in front of the ATO API.</summary>
    private static Dictionary<string, string> BuildHeaders(CookieContainer jar, string appDetails, string? range = null, string? referer = null)
    {
        var session = jar.GetCookies(new Uri(AtoConstants.AtoOnlineOrigin))[AtoConstants.AtoSessionCookieName];
        if (session is null || string.IsNullOrEmpty(session.Value))
            throw new MissingJsonField(AtoConstants.AtoOnlineOrigin, AtoConstants.AtoSessionCookieName);

        var h = new Dictionary<string, string>
        {
            ["accept"] = "application/json, text/javascript, */*; q=0.01",
            ["accept-language"] = "en-US,en;q=0.9",
            [AtoConstants.HdrApplicationDetails] = appDetails,
            [AtoConstants.HdrAtoCsrfHeader] = session.Value,
            [AtoConstants.HdrAtoIsfProxyRoute] = "REST",
            ["priority"] = "u=1, i",
            ["referer"] = referer ?? $"{AtoConstants.AtoOnlineOrigin}/Business/ContextSelection",
            ["sec-ch-ua"] = "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
            ["sec-ch-ua-mobile"] = "?0",
            ["sec-ch-ua-platform"] = "\"Windows\"",
            ["sec-fetch-dest"] = "empty",
            ["sec-fetch-mode"] = "cors",
            ["sec-fetch-site"] = "same-origin",
            [AtoConstants.HdrRequestedWith] = "XMLHttpRequest",
        };
        if (range is not null) h["range"] = range;
        return h;
    }
}
