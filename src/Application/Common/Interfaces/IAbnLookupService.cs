namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>The ABN Lookup background job body. Enqueued via <see cref="IJobScheduler"/>
/// and executed on a Hangfire worker (its own DI scope, no HttpContext).</summary>
public interface IAbnLookupService
{
    Task RunLookupAsync(string userId, CancellationToken cancellationToken);
}
