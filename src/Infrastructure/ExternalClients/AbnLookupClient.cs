using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Application.Common.Models;
using BusinessPortal.Domain.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.ExternalClients;

/// <summary>Talks to the data.gov.au CKAN datastore for the ASIC Business Names
/// register. Ported faithfully from lib/abn-lookup.ts. Public dataset; optional
/// token via config key <c>AbnLookup:ApiToken</c> for higher rate limits.</summary>
public partial class AbnLookupClient(HttpClient http, IConfiguration config, ILogger<AbnLookupClient> logger)
    : IAbnLookupClient
{
    private const string ResourceId = "55ad4b1c-5eeb-44ea-8b29-d410da431be3";
    private const string Endpoint = "https://data.gov.au/data/api/action/datastore_search";

    private readonly string? _token = config["AbnLookup:ApiToken"];

    public async Task<IReadOnlyList<AbnRegisteredName>> LookupBusinessNamesByAbnAsync(string abn, CancellationToken cancellationToken)
    {
        var clean = AbnUtil.NormaliseAbn(abn);
        if (clean.Length != 11) return [];

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, Endpoint)
            {
                Content = JsonContent.Create(new { resource_id = ResourceId, limit = 50, q = clean }),
            };
            if (!string.IsNullOrWhiteSpace(_token))
                req.Headers.TryAddWithoutValidation("Authorization", _token);

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(15));

            using var resp = await http.SendAsync(req, cts.Token);
            if (!resp.IsSuccessStatusCode)
            {
                logger.LogWarning("ABN lookup HTTP {Status} for {Abn}", (int)resp.StatusCode, clean);
                return [];
            }

            await using var stream = await resp.Content.ReadAsStreamAsync(cts.Token);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: cts.Token);
            var root = doc.RootElement;

            if (!root.TryGetProperty("success", out var ok) || ok.ValueKind != JsonValueKind.True) return [];
            if (!root.TryGetProperty("result", out var result) || !result.TryGetProperty("records", out var records)) return [];

            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var results = new List<AbnRegisteredName>();
            foreach (var row in records.EnumerateArray())
            {
                var parsed = ParseRecord(row);
                // Keep only rows whose ABN actually matches; de-dup by name.
                if (parsed is null || parsed.Abn != clean) continue;
                if (!seen.Add(parsed.Name)) continue;
                results.Add(parsed);
            }
            return results;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ABN lookup failed for {Abn}", clean);
            return [];
        }
    }

    private static AbnRegisteredName? ParseRecord(JsonElement row)
    {
        string Get(params string[] keys)
        {
            foreach (var k in keys)
            {
                if (!row.TryGetProperty(k, out var v)) continue;
                if (v.ValueKind == JsonValueKind.String)
                {
                    var s = v.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) return s.Trim();
                }
                else if (v.ValueKind == JsonValueKind.Number)
                {
                    return v.ToString();
                }
            }
            return string.Empty;
        }

        var name = Get("BN_NAME", "Business Name", "name");
        var abn = AbnUtil.NormaliseAbn(Get("BN_ABN", "ABN", "abn"));
        if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(abn)) return null;

        return new AbnRegisteredName
        {
            Abn = abn,
            Name = name,
            Status = Get("BN_STATUS", "Status"),
            State = Get("BN_STATE_OF_REG", "State"),
            DateRegistered = NormaliseDate(Get("BN_REG_DT", "Registration Date")),
            CancelledAt = NormaliseDate(Get("BN_CANCEL_DT", "Cancellation Date")),
            RenewalDate = NormaliseDate(Get("BN_RENEW_DT", "BN_RENEWAL_DT", "Renewal Date")),
        };
    }

    /// <summary>Pull a YYYY-MM-DD out of ISO or DD/MM/YYYY (common in AU data).</summary>
    private static string NormaliseDate(string s)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;
        var iso = IsoDate().Match(s);
        if (iso.Success) return iso.Groups[1].Value;
        var au = AuDate().Match(s);
        if (au.Success) return $"{au.Groups[3].Value}-{au.Groups[2].Value}-{au.Groups[1].Value}";
        return string.Empty;
    }

    [GeneratedRegex(@"^(\d{4}-\d{2}-\d{2})")]
    private static partial Regex IsoDate();

    [GeneratedRegex(@"^(\d{2})/(\d{2})/(\d{4})")]
    private static partial Regex AuDate();
}
