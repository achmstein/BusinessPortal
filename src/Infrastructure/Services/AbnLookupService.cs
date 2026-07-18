using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.Services;

/// <summary>The ABN Lookup background job. Runs on a Hangfire worker (its own DI
/// scope). Re-reads the user's ABNs, looks up business names on data.gov.au, adds
/// any new ones, updates progress, and drops a confirmation message. Ported from
/// the original runAbnLookupWork (data.gov.au portion; the ASIC-Connect renewal
/// enrichment is a separate integration).</summary>
public class AbnLookupService(
    IApplicationDbContext context,
    IAbnLookupClient client,
    ILogger<AbnLookupService> logger) : IAbnLookupService
{
    public async Task RunLookupAsync(string userId, CancellationToken cancellationToken)
    {
        var job = await context.AbnLookupJobs
            .Where(j => j.UserId == userId)
            .OrderByDescending(j => j.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (job is null) return;

        try
        {
            var validAbns = (await context.BusinessEntities
                    .Where(e => e.UserId == userId)
                    .Select(e => e.Abn)
                    .ToListAsync(cancellationToken))
                .Select(AbnUtil.NormaliseAbn)
                .Where(a => a.Length == 11)
                .Distinct()
                .ToList();

            job.TotalAbns = validAbns.Count;
            await context.SaveChangesAsync(cancellationToken);

            var existingNames = new HashSet<string>(
                await context.BusinessNames.Where(b => b.UserId == userId).Select(b => b.Name).ToListAsync(cancellationToken),
                StringComparer.OrdinalIgnoreCase);

            var added = 0;
            foreach (var abn in validAbns)
            {
                var results = await client.LookupBusinessNamesByAbnAsync(abn, cancellationToken);
                foreach (var r in results)
                {
                    if (!string.IsNullOrEmpty(r.CancelledAt)) continue; // skip cancelled
                    if (!existingNames.Add(r.Name)) continue;           // already tracked

                    context.BusinessNames.Add(new BusinessName
                    {
                        UserId = userId,
                        Name = r.Name,
                        DateRegistered = r.DateRegistered,
                        RenewalDate = r.RenewalDate,
                        AsicKey = string.Empty,
                    });
                    added++;
                }

                job.AbnsProcessed++;
                await context.SaveChangesAsync(cancellationToken); // progress for the polling UI
            }

            job.AddedCount = added;
            job.Status = AbnLookupStatus.Done;
            job.CompletedAt = DateTimeOffset.UtcNow;

            context.Messages.Add(new Message
            {
                UserId = userId,
                Direction = MessageDirection.Inbound,
                Subject = "Re: ABN Lookup information request",
                Body = added > 0
                    ? $"We connected to the ABN Register and added {added} business name(s) registered to your ABN(s)."
                    : "We checked the ABN Register — there were no new business names to add.",
                Read = false,
                AdminRead = true,
            });

            await context.SaveChangesAsync(cancellationToken);
            logger.LogInformation("ABN lookup for {UserId} complete: {Added} added across {Total} ABN(s).",
                userId, added, validAbns.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "ABN lookup job failed for user {UserId}", userId);
            job.Status = AbnLookupStatus.Failed;
            job.Error = ex.Message;
            job.CompletedAt = DateTimeOffset.UtcNow;
            await context.SaveChangesAsync(CancellationToken.None);
        }
    }
}
