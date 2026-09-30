using BusinessPortal.Application.Common.Interfaces;

namespace BusinessPortal.Web.Endpoints;

/// <summary>Runs a Renewtron sync on request (a sign-in link for an account the
/// scheduled sync hasn't created yet). One run at a time: a caller that arrives
/// while a run is going waits for it and reuses its result instead of starting
/// another, so a burst of clicks costs one sync. The endpoint's rate limit caps the rest.</summary>
internal static class OnDemandRenewtronSync
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static readonly TimeSpan MaxWait = TimeSpan.FromSeconds(30);
    private static DateTimeOffset _lastFinished = DateTimeOffset.MinValue;

    /// <summary>True when a sync ran (or had just run), so it's worth looking the user up again.</summary>
    public static async Task<bool> RunAsync(IRenewtronSyncService sync, ILoggerFactory loggers, CancellationToken ct)
    {
        var requestedAt = DateTimeOffset.UtcNow;
        if (!await Gate.WaitAsync(MaxWait, ct)) return false;
        try
        {
            // Someone else's run started and finished while we waited: it covers us too.
            if (_lastFinished >= requestedAt)
                return true;

            var result = await sync.SyncAsync(ct);
            _lastFinished = DateTimeOffset.UtcNow;
            return result.Configured;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            loggers.CreateLogger(typeof(OnDemandRenewtronSync)).LogError(ex, "On-demand Renewtron sync for a sign-in link failed");
            return false;
        }
        finally
        {
            Gate.Release();
        }
    }
}
