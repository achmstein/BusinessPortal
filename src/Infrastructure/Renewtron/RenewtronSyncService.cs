using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Services;
using BusinessPortal.Infrastructure.Data;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Infrastructure.Renewtron;

/// <summary>Polls Renewtron for completed business-name renewals and provisions a
/// portal login for each customer. Pull, not push, on purpose: Renewtron's DB is
/// the record of ALL renewals regardless of where the sale came from (its web
/// wizard, Ontraport, bulk uploads), Renewtron itself needs no changes, and a
/// missed run self-heals on the next one. Idempotent three ways: the provision log
/// is unique per renewal, users are keyed by email, and the renewal-date extension
/// is guarded by a per-renewal marker in BusinessName.RenewalTransactionIds.
/// Runs on a Hangfire schedule and from the admin "sync now" button.</summary>
public class RenewtronSyncService(
    RenewtronClient client,
    UserProvisioningService provisioner,
    ApplicationDbContext context,
    IOptionsMonitor<RenewtronOptions> options,
    ILogger<RenewtronSyncService> logger) : IRenewtronSyncService
{
    private const int PageSize = 200;
    private const int MaxPages = 50;

    public async Task<RenewtronSyncResult> SyncAsync(CancellationToken cancellationToken)
    {
        var current = options.CurrentValue;
        if (string.IsNullOrWhiteSpace(current.BaseUrl) || string.IsNullOrWhiteSpace(current.ApiKey))
            return new RenewtronSyncResult(Configured: false, 0, 0, 0, 0, 0,
                "Renewtron sync is off — set the base URL and API key in Settings.");

        var items = await FetchCompletedAsync(current, cancellationToken);

        // One dictionary read decides what's new; details are re-fetched tracked
        // inside ProcessAsync (the tracker may be cleared after a failure).
        var ids = items.Select(i => i.Id).ToList();
        var seen = await context.RenewtronProvisionLogs.AsNoTracking()
            .Where(l => ids.Contains(l.RenewalId))
            .ToDictionaryAsync(l => l.RenewalId, cancellationToken);

        int created = 0, updated = 0, skipped = 0, failed = 0;
        foreach (var item in items.OrderBy(i => i.CompletedAt))
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (seen.TryGetValue(item.Id, out var prior)
                && (prior.Outcome != ProvisionOutcome.Failed || prior.Attempts >= current.MaxAttempts))
                continue;

            try
            {
                switch (await ProcessAsync(item, cancellationToken))
                {
                    case ProvisionOutcome.Created: created++; break;
                    case ProvisionOutcome.Updated: updated++; break;
                    case ProvisionOutcome.Skipped: skipped++; break;
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                failed++;
                logger.LogError(ex, "Renewtron sync failed for renewal {RenewalId} ({Email})", item.Id, item.Email);
                await RecordFailureAsync(item, ex.Message, cancellationToken);
            }
        }

        var result = new RenewtronSyncResult(true, items.Count, created, updated, skipped, failed, null);
        logger.LogInformation(
            "Renewtron sync: {Fetched} completed renewals in window, {Created} logins created, {Updated} updated, {Skipped} skipped, {Failed} failed",
            result.Fetched, result.Created, result.Updated, result.Skipped, result.Failed);
        return result;
    }

    private async Task<List<RenewtronRenewalItem>> FetchCompletedAsync(RenewtronOptions current, CancellationToken ct)
    {
        var dateFrom = DateTime.UtcNow.AddDays(-Math.Max(1, current.PollWindowDays));
        var items = new List<RenewtronRenewalItem>();
        for (var page = 1; page <= MaxPages; page++)
        {
            var result = await client.GetCompletedRenewalsAsync(dateFrom, page, PageSize, ct);
            items.AddRange(result.Items);
            if (result.Items.Count == 0 || items.Count >= result.TotalCount) break;
        }
        return items;
    }

    private async Task<ProvisionOutcome> ProcessAsync(RenewtronRenewalItem item, CancellationToken ct)
    {
        var log = await context.RenewtronProvisionLogs
            .FirstOrDefaultAsync(l => l.RenewalId == item.Id, ct);
        if (log is null)
        {
            log = new RenewtronProvisionLog { RenewalId = item.Id };
            context.RenewtronProvisionLogs.Add(log);
        }

        var email = item.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        log.Email = email;
        log.BusinessName = item.BusinessName ?? string.Empty;
        log.Abn = item.Abn ?? string.Empty;
        log.Source = item.Source ?? string.Empty;
        log.Attempts++;
        log.ProcessedAt = DateTimeOffset.UtcNow;

        // UserManager.CreateAsync saves the whole tracker eagerly; if a later step
        // throws, this row must have stranded as retryable, not as a false success.
        log.Outcome = ProvisionOutcome.Failed;
        log.Detail = "processing did not finish";

        // Bulk-upload renewals often carry no email — nothing to build a login on.
        if (email.Length == 0)
        {
            log.Outcome = ProvisionOutcome.Skipped;
            log.Detail = "renewal has no email";
            await context.SaveChangesAsync(ct);
            return ProvisionOutcome.Skipped;
        }

        // The list view has no phone/DOB (and, for Ontraport-sourced renewals, no
        // name) — the detail call fills what it can.
        var detail = await client.GetRenewalDetailAsync(item.Id, ct);
        var (firstName, lastName) = SplitName(item.Lead?.FullName ?? detail?.Lead?.FullName);

        var provision = await provisioner.EnsureUserAsync(email, new ProvisionProfile(
            FirstName: firstName,
            LastName: lastName,
            Phone: detail?.MobileNumber ?? string.Empty,
            Dob: detail?.DateOfBirth ?? string.Empty), ct);
        if (provision.User is null)
            throw new InvalidOperationException($"could not create portal user: {provision.Error}");

        await ApplyRenewalAsync(provision.User.Id, item, ct);

        log.UserId = provision.User.Id;
        log.Outcome = provision.Created ? ProvisionOutcome.Created : ProvisionOutcome.Updated;
        log.Detail = null;
        await context.SaveChangesAsync(ct);
        return log.Outcome;
    }

    /// <summary>Upsert the renewed business name (case-insensitive by name within
    /// the user, like the Ontraport sync) and push its renewal date out. The
    /// "renewtron:{id}" marker in RenewalTransactionIds means reprocessing —
    /// including an overlap between the recurring job and "sync now" — can never
    /// extend the date twice.</summary>
    private async Task ApplyRenewalAsync(string userId, RenewtronRenewalItem item, CancellationToken ct)
    {
        var name = item.BusinessName?.Trim() ?? string.Empty;
        if (name.Length == 0 || item.RenewalYears <= 0) return;

        var marker = $"renewtron:{item.Id}";
        var names = await context.BusinessNames.Where(b => b.UserId == userId).ToListAsync(ct);
        var bn = names.FirstOrDefault(b => string.Equals(b.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));

        if (bn is null)
        {
            bn = new BusinessName
            {
                UserId = userId,
                Name = name,
                DateRegistered = string.Empty,
                RenewalDate = RenewalDateMath.Extend(string.Empty, item.RenewalYears),
                AsicKey = string.Empty,
                RenewalTransactionIds = [marker],
            };
            context.BusinessNames.Add(bn);
        }
        else if (!bn.RenewalTransactionIds.Contains(marker))
        {
            bn.RenewalDate = RenewalDateMath.Extend(bn.RenewalDate, item.RenewalYears);
            bn.RenewalTransactionIds = [.. bn.RenewalTransactionIds, marker]; // new list → EF detects the change
        }
        else
        {
            return; // already applied — don't record the renewal twice either
        }

        context.BusinessNameRenewals.Add(new BusinessNameRenewal
        {
            UserId = userId,
            BusinessNameId = bn.Id,
            BusinessName = bn.Name,
            Years = item.RenewalYears,
            NewRenewalDate = bn.RenewalDate,
            Source = "Renewtron",
            Reference = item.Id.ToString(),
            RenewedAt = DateTimeOffset.UtcNow,
        });
    }

    /// <summary>A failure may leave half-applied changes in the tracker (e.g. the
    /// welcome message added before the business-name upsert threw). Drop them so
    /// only the failure record is saved; the next run redoes the work from scratch
    /// against its idempotency guards.</summary>
    private async Task RecordFailureAsync(RenewtronRenewalItem item, string error, CancellationToken ct)
    {
        try
        {
            context.ChangeTracker.Clear();
            var log = await context.RenewtronProvisionLogs.FirstOrDefaultAsync(l => l.RenewalId == item.Id, ct);
            if (log is null)
            {
                log = new RenewtronProvisionLog { RenewalId = item.Id };
                context.RenewtronProvisionLogs.Add(log);
            }
            log.Email = item.Email?.Trim().ToLowerInvariant() ?? string.Empty;
            log.BusinessName = item.BusinessName ?? string.Empty;
            log.Abn = item.Abn ?? string.Empty;
            log.Source = item.Source ?? string.Empty;
            log.Outcome = ProvisionOutcome.Failed;
            log.Detail = error.Length > 2000 ? error[..2000] : error;
            log.Attempts++;
            log.ProcessedAt = DateTimeOffset.UtcNow;
            await context.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // Never let bookkeeping kill the run — the renewal just retries next time.
            logger.LogError(ex, "Could not record Renewtron sync failure for {RenewalId}", item.Id);
            context.ChangeTracker.Clear();
        }
    }

    private static (string First, string Last) SplitName(string? fullName)
    {
        var trimmed = fullName?.Trim() ?? string.Empty;
        if (trimmed.Length == 0) return (string.Empty, string.Empty);
        var space = trimmed.IndexOf(' ');
        return space < 0
            ? (trimmed, string.Empty)
            : (trimmed[..space], trimmed[(space + 1)..].Trim());
    }
}
