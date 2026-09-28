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
    string? Message,
    int KeysApplied = 0);

/// <summary>Mirrors Renewtron (the ASIC business-name renewal service) into the
/// portal: provisions a login for every paying customer, tracks each renewal from
/// payment to ASIC confirmation, extends the renewal date when it completes, and
/// applies ASIC keys Renewtron has retrieved. Idempotent — safe to run on a
/// schedule and on demand. Implemented in Infrastructure.</summary>
public interface IRenewtronSyncService
{
    Task<RenewtronSyncResult> SyncAsync(CancellationToken cancellationToken);
}
