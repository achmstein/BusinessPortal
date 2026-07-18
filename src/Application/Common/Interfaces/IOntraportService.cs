namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>Result of an Ontraport webhook — an HTTP status + a JSON body the
/// endpoint returns verbatim (mirrors the original route responses).</summary>
public record OntraportResult(int Status, object Body);

/// <summary>Handles the two inbound Ontraport webhooks (contact sync + renewal-paid).
/// Implemented in Infrastructure (needs UserManager). Secret verification lives here
/// too so the endpoints stay thin.</summary>
public interface IOntraportService
{
    bool VerifyWebhookSecret(string? provided);
    bool VerifyRenewalSecret(string? provided);

    Task<OntraportResult> SyncContactAsync(IReadOnlyDictionary<string, string> payload, CancellationToken cancellationToken);
    Task<OntraportResult> ProcessRenewalPaidAsync(IReadOnlyDictionary<string, string> payload, CancellationToken cancellationToken);
}
