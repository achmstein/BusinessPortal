using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Infrastructure.Renewtron;

/// <summary>The slice of Renewtron's admin renewals API the sync reads. Enums come
/// over as strings ("Completed", "Ontraport"); dates as ISO strings.</summary>
public sealed class RenewtronLead
{
    public string? FullName { get; set; }
    public string? Email { get; set; }
}

public sealed class RenewtronRenewalItem
{
    public Guid Id { get; set; }
    public string? Abn { get; set; }
    public string? BusinessName { get; set; }
    public int RenewalYears { get; set; }
    public string? Status { get; set; }
    public string? Source { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Email { get; set; }
    public string? TransactionReference { get; set; }
    public RenewtronLead? Lead { get; set; }
}

public sealed class RenewtronRenewalPage
{
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<RenewtronRenewalItem> Items { get; set; } = [];
}

/// <summary>GET /api/admin/renewals/{id} — only the fields the list view lacks.</summary>
public sealed class RenewtronRenewalDetail
{
    public Guid Id { get; set; }
    public string? MobileNumber { get; set; }
    public string? DateOfBirth { get; set; }
    public RenewtronLead? Lead { get; set; }
}

/// <summary>Typed client for Renewtron's admin API, authenticated with the same
/// X-Api-Key shared secret Mastertron uses. IOptionsMonitor so credentials saved
/// from the admin Settings UI apply without a restart.</summary>
public class RenewtronClient(HttpClient http, IOptionsMonitor<RenewtronOptions> options)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<RenewtronRenewalPage> GetCompletedRenewalsAsync(
        DateTime dateFromUtc, int page, int pageSize, CancellationToken ct)
    {
        using var request = Build(
            $"/api/admin/renewals?status=Completed&dateFrom={dateFromUtc:yyyy-MM-dd}&page={page}&pageSize={pageSize}");
        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException(
                $"Renewtron renewals list failed: {(int)response.StatusCode} {response.ReasonPhrase}");
        return await response.Content.ReadFromJsonAsync<RenewtronRenewalPage>(Json, ct)
            ?? new RenewtronRenewalPage();
    }

    public async Task<RenewtronRenewalDetail?> GetRenewalDetailAsync(Guid id, CancellationToken ct)
    {
        using var request = Build($"/api/admin/renewals/{id}");
        using var response = await http.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException(
                $"Renewtron renewal detail failed: {(int)response.StatusCode} {response.ReasonPhrase}");
        return await response.Content.ReadFromJsonAsync<RenewtronRenewalDetail>(Json, ct);
    }

    private HttpRequestMessage Build(string pathAndQuery)
    {
        var current = options.CurrentValue;
        var request = new HttpRequestMessage(
            HttpMethod.Get, (current.BaseUrl ?? string.Empty).TrimEnd('/') + pathAndQuery);
        if (!string.IsNullOrWhiteSpace(current.ApiKey))
            request.Headers.Add("X-Api-Key", current.ApiKey.Trim());
        return request;
    }
}
