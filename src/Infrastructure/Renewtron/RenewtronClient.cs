using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Infrastructure.Renewtron;

/// <summary>One renewal from GET /api/partner/renewals. Enums come over as strings
/// ("Completed", "Ontraport"); dates as ISO strings.</summary>
public sealed class RenewtronRenewalItem
{
    public Guid Id { get; set; }
    public string? Status { get; set; }
    public string? Source { get; set; }
    public string? BusinessName { get; set; }
    public string? Abn { get; set; }
    public int RenewalYears { get; set; }
    public decimal Amount { get; set; }
    public string? Email { get; set; }
    public string? FullName { get; set; }
    public string? MobileNumber { get; set; }
    public string? DateOfBirth { get; set; }
    public DateTime InitiatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? TransactionReference { get; set; }
    public string? CustomerMessage { get; set; }
    public DateTime? NextRetryAt { get; set; }
}

public sealed class RenewtronRenewalPage
{
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<RenewtronRenewalItem> Items { get; set; } = [];
}

public sealed record RenewtronKeyRequestBody(
    string BusinessName, string? Abn, string Email, string GivenNames, string FamilyName, string Phone,
    string? ExternalReference);

/// <summary>POST /api/partner/asic-key-requests. <see cref="Status"/> is
/// "KeyAvailable" (with <see cref="AsicKey"/>) when Renewtron already holds it.</summary>
public sealed class RenewtronKeyRequestResult
{
    public Guid? Id { get; set; }
    public string? Status { get; set; }
    public DateTime? CreatedAt { get; set; }
    public string? AsicKey { get; set; }
}

public sealed class RenewtronKeyRequestState
{
    public Guid Id { get; set; }
    public string? Status { get; set; }
    public string? BusinessName { get; set; }
    public DateTime? KeyReceivedAt { get; set; }
    public string? AsicKey { get; set; }
}

public sealed class RenewtronAsicKey
{
    public Guid NotificationId { get; set; }
    public string? BusinessName { get; set; }
    public string? Abn { get; set; }
    public string? AsicKey { get; set; }
    public DateTime ReceivedAt { get; set; }
}

/// <summary>Raised when Renewtron rejects a request as invalid (400) — the
/// message is Renewtron's and safe to show.</summary>
public sealed class RenewtronValidationException(string message) : Exception(message);

/// <summary>Typed client for Renewtron's partner API (/api/partner/*), authenticated
/// with the scoped partner key in X-Api-Key — it can read renewals and raise ASIC
/// key requests, nothing else. IOptionsMonitor so credentials saved from the admin
/// Settings UI apply without a restart.</summary>
public class RenewtronClient(HttpClient http, IOptionsMonitor<RenewtronOptions> options)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(options.CurrentValue.BaseUrl) && !string.IsNullOrWhiteSpace(options.CurrentValue.ApiKey);

    /// <summary>Renewals of every status initiated on or after <paramref name="sinceUtc"/>.</summary>
    public async Task<RenewtronRenewalPage> GetRenewalsAsync(DateTime sinceUtc, int page, int pageSize, CancellationToken ct)
    {
        using var request = Build(HttpMethod.Get,
            $"/api/partner/renewals?since={sinceUtc:yyyy-MM-dd}&page={page}&pageSize={pageSize}");
        using var response = await http.SendAsync(request, ct);
        await EnsureSuccessAsync(response, "renewals list", ct);
        return await response.Content.ReadFromJsonAsync<RenewtronRenewalPage>(Json, ct) ?? new RenewtronRenewalPage();
    }

    public async Task<RenewtronKeyRequestResult> RequestAsicKeyAsync(RenewtronKeyRequestBody body, CancellationToken ct)
    {
        using var request = Build(HttpMethod.Post, "/api/partner/asic-key-requests");
        request.Content = JsonContent.Create(body, options: Json);
        using var response = await http.SendAsync(request, ct);
        await EnsureSuccessAsync(response, "ASIC key request", ct);
        return await response.Content.ReadFromJsonAsync<RenewtronKeyRequestResult>(Json, ct)
            ?? throw new HttpRequestException("Renewtron returned an empty ASIC key request response.");
    }

    public async Task<RenewtronKeyRequestState?> GetAsicKeyRequestAsync(Guid id, CancellationToken ct)
    {
        using var request = Build(HttpMethod.Get, $"/api/partner/asic-key-requests/{id}");
        using var response = await http.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        await EnsureSuccessAsync(response, "ASIC key request status", ct);
        return await response.Content.ReadFromJsonAsync<RenewtronKeyRequestState>(Json, ct);
    }

    /// <summary>Keys Renewtron has extracted from ASIC's notification emails since
    /// <paramref name="sinceUtc"/>, whoever requested them.</summary>
    public async Task<List<RenewtronAsicKey>> GetAsicKeysAsync(DateTime sinceUtc, CancellationToken ct)
    {
        using var request = Build(HttpMethod.Get, $"/api/partner/asic-keys?since={sinceUtc:O}");
        using var response = await http.SendAsync(request, ct);
        await EnsureSuccessAsync(response, "ASIC keys", ct);
        return await response.Content.ReadFromJsonAsync<List<RenewtronAsicKey>>(Json, ct) ?? [];
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, string what, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;
        if (response.StatusCode == HttpStatusCode.BadRequest)
        {
            var error = await TryReadErrorAsync(response, ct);
            throw new RenewtronValidationException(error ?? "Renewtron rejected the request.");
        }
        throw new HttpRequestException($"Renewtron {what} failed: {(int)response.StatusCode} {response.ReasonPhrase}");
    }

    private static async Task<string?> TryReadErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            return doc.RootElement.TryGetProperty("error", out var e) ? e.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private HttpRequestMessage Build(HttpMethod method, string pathAndQuery)
    {
        var current = options.CurrentValue;
        var request = new HttpRequestMessage(method, (current.BaseUrl ?? string.Empty).TrimEnd('/') + pathAndQuery);
        if (!string.IsNullOrWhiteSpace(current.ApiKey))
            request.Headers.Add("X-Api-Key", current.ApiKey.Trim());
        return request;
    }
}
