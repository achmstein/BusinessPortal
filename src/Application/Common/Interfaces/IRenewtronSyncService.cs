namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>Summary of one Renewtron sync run (returned by the admin "sync now"
/// endpoint and logged by the recurring job).</summary>
public sealed record RenewtronSyncResult(
    bool Configured,
    int Fetched,
    int Created,
    int Updated,
    int Skipped,
    int Failed,
    string? Message);

/// <summary>Polls Renewtron (the ASIC business-name renewal service) for completed
/// renewals and provisions a portal login for each customer: create-or-update the
/// user, upsert the renewed business name, and email new users a set-password
/// invite. Idempotent via RenewtronProvisionLog — safe to run on a schedule and
/// on demand. Implemented in Infrastructure (needs UserManager + the HTTP client).</summary>
public interface IRenewtronSyncService
{
    Task<RenewtronSyncResult> SyncAsync(CancellationToken cancellationToken);
}
