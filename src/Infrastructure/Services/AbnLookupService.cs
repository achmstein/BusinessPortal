using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Services;
using BusinessPortal.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.Services;

/// <summary>The ABN Lookup background job. Runs on a Hangfire worker (its own DI
/// scope). Re-reads the user's ABNs, looks up business names on data.gov.au, adds
/// any new ones, updates progress, and drops a confirmation message. Ported from
/// the original runAbnLookupWork (data.gov.au portion; the ASIC-Connect renewal
/// enrichment is a separate integration).</summary>
public class AbnLookupService(
    ApplicationDbContext context,
    IAbnLookupClient client,
    IAsicRegistryClient asic,
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
            // The businesses' ABNs plus the one on "Your details" — customers type
            // their ABN there and expect it to be searched too.
            var profileAbn = await context.Users
                .Where(u => u.Id == userId)
                .Select(u => u.Profile.Abn)
                .FirstOrDefaultAsync(cancellationToken);
            var validAbns = (await context.BusinessEntities
                    .Where(e => e.UserId == userId)
                    .Select(e => e.Abn)
                    .ToListAsync(cancellationToken))
                .Append(profileAbn ?? string.Empty)
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

            // ─── ASIC Connect enrichment: fill in real renewal/registration dates that
            // data.gov.au doesn't carry. Only runs when a 2Captcha key is configured;
            // skipped gracefully otherwise. Sequential (each scrape is 30–90s + costs credit).
            var enriched = 0;
            if (asic.IsConfigured)
            {
                var names = await context.BusinessNames.Where(b => b.UserId == userId).ToListAsync(cancellationToken);
                var byName = names
                    .GroupBy(n => n.Name.Trim(), StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

                foreach (var abn in validAbns)
                {
                    try
                    {
                        var asicNames = await asic.SearchByAbnAsync(abn, cancellationToken);
                        foreach (var an in asicNames)
                        {
                            if (string.IsNullOrWhiteSpace(an.Name) || !byName.TryGetValue(an.Name.Trim(), out var rec)) continue;
                            var changed = false;
                            if (string.IsNullOrEmpty(rec.RenewalDate) && !string.IsNullOrEmpty(an.RenewalDate)) { rec.RenewalDate = an.RenewalDate; changed = true; }
                            if (string.IsNullOrEmpty(rec.DateRegistered) && !string.IsNullOrEmpty(an.DateRegistered)) { rec.DateRegistered = an.DateRegistered; changed = true; }
                            if (changed) enriched++;
                        }
                        await context.SaveChangesAsync(cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "ASIC enrichment failed for ABN {Abn} (user {UserId})", abn, userId);
                    }
                }
            }

            job.AddedCount = added;
            job.EnrichedCount = enriched;
            job.Status = AbnLookupStatus.Done;
            job.CompletedAt = DateTimeOffset.UtcNow;

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
