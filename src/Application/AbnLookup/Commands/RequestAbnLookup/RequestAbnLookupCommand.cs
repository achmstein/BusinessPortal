using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.AbnLookup.Commands.RequestAbnLookup;

/// <summary>Kick off an ABN Lookup for the current user's businesses. Records a
/// "running" job then enqueues the background worker (fire-and-forget, like the
/// original requestAbnLookup).</summary>
public record RequestAbnLookupCommand : IRequest<Guid>;

public class RequestAbnLookupCommandHandler(IApplicationDbContext context, IUser user, IJobScheduler jobs)
    : IRequestHandler<RequestAbnLookupCommand, Guid>
{
    public async Task<Guid> Handle(RequestAbnLookupCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? throw new InvalidOperationException("No current user.");

        var abns = await context.BusinessEntities
            .AsNoTracking()
            .Where(e => e.UserId == userId)
            .Select(e => e.Abn)
            .ToListAsync(cancellationToken);

        var validCount = abns
            .Select(AbnUtil.NormaliseAbn)
            .Where(a => a.Length == 11)
            .Distinct()
            .Count();

        // Keep a single job row per user — clear any prior one.
        var prior = await context.AbnLookupJobs
            .Where(j => j.UserId == userId)
            .ToListAsync(cancellationToken);
        if (prior.Count > 0)
            context.AbnLookupJobs.RemoveRange(prior);

        var job = new AbnLookupJob
        {
            UserId = userId,
            Status = AbnLookupStatus.Running,
            StartedAt = DateTimeOffset.UtcNow,
            TotalAbns = validCount,
        };
        context.AbnLookupJobs.Add(job);
        await context.SaveChangesAsync(cancellationToken);

        // Hand off — the worker re-reads the user's ABNs and does the lookups.
        jobs.Enqueue<IAbnLookupService>(s => s.RunLookupAsync(userId, CancellationToken.None));

        return job.Id;
    }
}
