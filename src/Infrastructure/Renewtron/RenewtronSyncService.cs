using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Services;
using BusinessPortal.Infrastructure.Data;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Infrastructure.Renewtron;

/// <summary>Mirrors Renewtron into the portal. Renewtron is the system of record
/// for every renewal (its wizard's Stripe checkout, Ontraport sales it syncs, bulk
/// uploads) and for ASIC keys; the portal reads its partner API and never talks
/// to Ontraport itself.
///
/// Each run starts with paid Ontraport sales Renewtron has synced but not yet
/// renewed (it waits for ASIC's window): the customer gets a login and a
/// "Scheduled" row straight away. Then, for every renewal initiated inside the
/// poll window:
///  1. provisions a portal login for the customer — once per renewal, guarded by
///     RenewtronProvisionLog — as soon as it's paid, not only once ASIC confirms;
///  2. upserts a BusinessNameRenewal carrying Renewtron's live status, so the
///     customer sees "in progress" / "needs attention" while Renewtron works;
///  3. on completion, extends the business name's renewal date, guarded by the
///     "renewtron:{id}" marker so it happens exactly once.
/// Then it refreshes open ASIC key requests and applies retrieved keys — directly
/// only where the customer paid to renew that name (see ApplyAsicKeysAsync).
/// Pull, not push: a missed run self-heals on the next.</summary>
public class RenewtronSyncService(
    RenewtronClient client,
    UserProvisioningService provisioner,
    ApplicationDbContext context,
    IOptionsMonitor<RenewtronOptions> options,
    ILogger<RenewtronSyncService> logger) : IRenewtronSyncService
{
    private const int PageSize = 200;
    private const int MaxPages = 50;

    /// <summary>How far back each run looks for ASIC keys Renewtron has retrieved.</summary>
    private static readonly TimeSpan KeyWindow = TimeSpan.FromDays(60);

    public async Task<RenewtronSyncResult> SyncAsync(CancellationToken cancellationToken)
    {
        var current = options.CurrentValue;
        if (!client.IsConfigured)
            return new RenewtronSyncResult(Configured: false, 0, 0, 0, 0, 0,
                "Renewtron sync is off — set the base URL and partner API key in Settings.");

        // Sales first: a paid Ontraport sale gets its login and a "Scheduled" row
        // now, and the renewal Renewtron creates later lands on that same row.
        var (salesCreated, salesFailed) = await SyncSalesAsync(current, cancellationToken);

        var items = await FetchRenewalsAsync(current, cancellationToken);

        var ids = items.Select(i => i.Id).ToList();
        var logs = await context.RenewtronProvisionLogs.AsNoTracking()
            .Where(l => ids.Contains(l.RenewalId))
            .ToDictionaryAsync(l => l.RenewalId, cancellationToken);
        var mirrored = await context.BusinessNameRenewals.AsNoTracking()
            .Where(r => r.RenewtronRenewalId != null && ids.Contains(r.RenewtronRenewalId.Value))
            .ToDictionaryAsync(r => r.RenewtronRenewalId!.Value, r => r.Status, cancellationToken);

        int created = salesCreated, updated = 0, skipped = 0, failed = salesFailed;
        foreach (var item in items.OrderBy(i => i.InitiatedAt))
        {
            cancellationToken.ThrowIfCancellationRequested();

            logs.TryGetValue(item.Id, out var log);
            var provisioned = log is { Outcome: ProvisionOutcome.Created or ProvisionOutcome.Updated };

            // Nothing left to do: the login exists and the portal already shows the
            // status Renewtron reports. Most renewals in the window take this path.
            if (provisioned && mirrored.TryGetValue(item.Id, out var status) && status == item.Status)
                continue;
            if (log is { Outcome: ProvisionOutcome.Skipped })
                continue;
            if (log is { Outcome: ProvisionOutcome.Failed } && log.Attempts >= current.MaxAttempts)
                continue;
            // With a start date set, an Ontraport renewal is only new if its sale is:
            // Renewtron lodges old sales' renewals weeks later, so a renewal started
            // after the cutoff can still belong to a customer from before it. New sales
            // were linked to their renewal by the sales step above.
            if (current.SyncFrom is not null && item.Source == "Ontraport" && !mirrored.ContainsKey(item.Id))
                continue;

            try
            {
                switch (await ProcessAsync(item, cancellationToken))
                {
                    case ProvisionOutcome.Created: created++; break;
                    case ProvisionOutcome.Updated when !provisioned: updated++; break;
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

        var keysApplied = 0;
        try
        {
            await RefreshKeyRequestsAsync(cancellationToken);
            keysApplied = await ApplyAsicKeysAsync(cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Keys are secondary to renewals — a key failure must not fail the run.
            logger.LogError(ex, "Renewtron ASIC key sync failed");
            context.ChangeTracker.Clear();
        }

        var result = new RenewtronSyncResult(true, items.Count, created, updated, skipped, failed, null, keysApplied);
        logger.LogInformation(
            "Renewtron sync: {Fetched} renewals in window, {Created} logins created, {Updated} linked to existing logins, {Skipped} skipped, {Failed} failed, {Keys} ASIC keys applied",
            result.Fetched, result.Created, result.Updated, result.Skipped, result.Failed, keysApplied);
        return result;
    }

    private async Task<List<RenewtronRenewalItem>> FetchRenewalsAsync(RenewtronOptions current, CancellationToken ct)
    {
        var since = current.EffectiveSince(DateTime.UtcNow);
        var items = new List<RenewtronRenewalItem>();
        for (var page = 1; page <= MaxPages; page++)
        {
            var result = await client.GetRenewalsAsync(since, page, PageSize, ct);
            items.AddRange(result.Items);
            if (result.Items.Count == 0 || items.Count >= result.TotalCount) break;
        }
        return items;
    }

    private async Task<ProvisionOutcome> ProcessAsync(RenewtronRenewalItem item, CancellationToken ct)
    {
        var log = await context.RenewtronProvisionLogs.FirstOrDefaultAsync(l => l.RenewalId == item.Id, ct);
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
        log.ProcessedAt = DateTimeOffset.UtcNow;

        // Bulk-upload renewals often carry no email — nothing to build a login on.
        if (email.Length == 0)
        {
            log.Attempts++;
            log.Outcome = ProvisionOutcome.Skipped;
            log.Detail = "renewal has no email";
            await context.SaveChangesAsync(ct);
            return ProvisionOutcome.Skipped;
        }

        var alreadyProvisioned = log.Outcome is ProvisionOutcome.Created or ProvisionOutcome.Updated
                                 && log.UserId is not null;
        string userId;
        ProvisionOutcome outcome;
        if (alreadyProvisioned)
        {
            userId = log.UserId!;
            outcome = log.Outcome;
        }
        else
        {
            log.Attempts++;
            // UserManager.CreateAsync saves the whole tracker eagerly; if a later step
            // throws, this row must be stranded as retryable, not as a false success.
            log.Outcome = ProvisionOutcome.Failed;
            log.Detail = "processing did not finish";

            var (firstName, lastName) = SplitName(item.FullName);
            var provision = await provisioner.EnsureUserAsync(email, new ProvisionProfile(
                FirstName: firstName,
                LastName: lastName,
                Phone: item.MobileNumber ?? string.Empty,
                Dob: item.DateOfBirth ?? string.Empty,
                Abn: item.Abn?.Trim() ?? string.Empty), ct);
            if (provision.User is null)
                throw new InvalidOperationException($"could not create portal user: {provision.Error}");

            userId = provision.User.Id;
            outcome = provision.Created ? ProvisionOutcome.Created : ProvisionOutcome.Updated;
        }

        await MirrorRenewalAsync(userId, item, ct);

        log.UserId = userId;
        log.Outcome = outcome;
        log.Detail = null;
        await context.SaveChangesAsync(ct);
        return outcome;
    }

    /// <summary>Upsert the portal's copy of this renewal, and apply it to the business
    /// name the first time it's seen as Completed.</summary>
    private async Task MirrorRenewalAsync(string userId, RenewtronRenewalItem item, CancellationToken ct)
    {
        var name = item.BusinessName?.Trim() ?? string.Empty;
        if (name.Length == 0) return;

        var reference = item.Id.ToString();
        // Rows written before renewals carried a Renewtron id stored it as Reference.
        var row = await context.BusinessNameRenewals.FirstOrDefaultAsync(r =>
            r.RenewtronRenewalId == item.Id || (r.RenewtronRenewalId == null && r.Source == "Renewtron" && r.Reference == reference), ct);
        if (row is null)
        {
            row = new BusinessNameRenewal { UserId = userId, RenewtronRenewalId = item.Id, Reference = reference };
            context.BusinessNameRenewals.Add(row);
        }

        var status = item.Status ?? "Pending";
        row.RenewtronRenewalId = item.Id;
        row.BusinessName = name;
        row.Abn = item.Abn?.Trim() ?? string.Empty;
        row.Years = item.RenewalYears;
        row.Source = item.Source ?? "Renewtron";
        row.Status = status;
        row.StatusMessage = status == "Completed" ? null : item.CustomerMessage;
        row.TransactionReference = item.TransactionReference;
        row.RenewedAt = new DateTimeOffset(DateTime.SpecifyKind(item.CompletedAt ?? item.InitiatedAt, DateTimeKind.Utc));

        var names = await context.BusinessNames.Where(b => b.UserId == userId).ToListAsync(ct);
        var bn = names.FirstOrDefault(b => string.Equals(b.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));

        // The customer's names appear as soon as they've paid — the one being renewed and
        // every other name the wizard found on their ABN — not only once ASIC confirms.
        // The renewal date stays empty until a renewal completes and sets it.
        bn ??= AddBusinessName(names, userId, name, item.RegistrationDate);
        foreach (var other in item.AbnBusinessNames ?? [])
        {
            var otherName = other.Name?.Trim() ?? string.Empty;
            if (otherName.Length > 0 && !names.Any(b => string.Equals(b.Name.Trim(), otherName, StringComparison.OrdinalIgnoreCase)))
                AddBusinessName(names, userId, otherName, other.RegistrationDate);
        }

        if (status == "Completed" && item.RenewalYears > 0)
        {
            var marker = $"renewtron:{item.Id}";
            if (!bn.RenewalTransactionIds.Contains(marker))
            {
                bn.RenewalDate = RenewalDateMath.Extend(bn.RenewalDate, item.RenewalYears);
                bn.RenewalTransactionIds = [.. bn.RenewalTransactionIds, marker]; // new list → EF detects the change
                row.NewRenewalDate = bn.RenewalDate;
            }
        }

        row.BusinessNameId = bn.Id;
    }

    private BusinessName AddBusinessName(List<BusinessName> names, string userId, string name, string? registrationDate)
    {
        var bn = new BusinessName
        {
            UserId = userId,
            Name = name,
            DateRegistered = PortalDate(registrationDate),
            RenewalDate = string.Empty,
            AsicKey = string.Empty,
        };
        context.BusinessNames.Add(bn);
        names.Add(bn);
        return bn;
    }

    /// <summary>Renewtron's dd/MM/yyyy (or ISO) date as the portal's yyyy-MM-dd; empty when unparseable.</summary>
    private static string PortalDate(string? value)
    {
        string[] formats = ["dd/MM/yyyy", "d/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd"];
        return DateOnly.TryParseExact(value?.Trim(), formats, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None, out var d)
            ? d.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)
            : string.Empty;
    }

    // ─── Ontraport sales (paid, before Renewtron has created the renewal) ───

    private async Task<(int Created, int Failed)> SyncSalesAsync(RenewtronOptions current, CancellationToken ct)
    {
        var since = current.EffectiveSince(DateTime.UtcNow);
        var sales = await client.GetSalesAsync(since, ct);
        int created = 0, failed = 0;
        foreach (var sale in sales.OrderBy(s => s.SyncedAt))
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                if (await ProcessSaleAsync(sale, current, ct)) created++;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                failed++;
                logger.LogError(ex, "Renewtron sale sync failed for sale {SaleId} ({Email})", sale.Id, sale.Email);
                context.ChangeTracker.Clear();
            }
        }
        // Renewtron drops a sale from this list when it turns ineligible (refund,
        // cancellation, underpayment). A scheduled row whose sale is still inside
        // the window but no longer listed has been withdrawn — flag it rather than
        // leave it "Scheduled" forever.
        var listed = sales.Select(x => x.Id).ToHashSet();
        var sinceOffset = new DateTimeOffset(since, TimeSpan.Zero);
        var withdrawn = await context.BusinessNameRenewals
            .Where(r => r.RenewtronSaleId != null && r.RenewtronRenewalId == null
                        && r.Status == "Scheduled" && r.RenewedAt >= sinceOffset)
            .ToListAsync(ct);
        foreach (var row in withdrawn.Where(r => !listed.Contains(r.RenewtronSaleId!.Value)))
        {
            row.Status = "Failed";
            row.StatusMessage = "This renewal needs attention from our team — we'll be in touch.";
        }
        await context.SaveChangesAsync(ct);

        return (created, failed);
    }

    /// <summary>Provision the customer once per sale (with the full profile Ontraport
    /// holds — address and TFN included — but only that first time, so later edits
    /// in the portal aren't overwritten), and keep a "Scheduled" row for the paid
    /// renewal until Renewtron creates it. Returns true when a login was created.</summary>
    private async Task<bool> ProcessSaleAsync(RenewtronSale sale, RenewtronOptions current, CancellationToken ct)
    {
        var email = sale.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var name = sale.BusinessName?.Trim() ?? string.Empty;
        if (email.Length == 0 || name.Length == 0) return false;

        // The provision log is keyed by Renewtron id; sale ids are their own Guids.
        var log = await context.RenewtronProvisionLogs.FirstOrDefaultAsync(l => l.RenewalId == sale.Id, ct);
        if (log is { Outcome: ProvisionOutcome.Failed } && log.Attempts >= current.MaxAttempts) return false;

        var createdLogin = false;
        string userId;
        if (log is { Outcome: ProvisionOutcome.Created or ProvisionOutcome.Updated, UserId: not null })
        {
            userId = log.UserId;
        }
        else
        {
            if (log is null)
            {
                log = new RenewtronProvisionLog { RenewalId = sale.Id, Source = "OntraportSale" };
                context.RenewtronProvisionLogs.Add(log);
            }
            log.Email = email;
            log.BusinessName = name;
            log.Abn = sale.Abn ?? string.Empty;
            log.Attempts++;
            log.ProcessedAt = DateTimeOffset.UtcNow;
            log.Outcome = ProvisionOutcome.Failed;
            log.Detail = "processing did not finish";

            var (firstName, lastName) = SplitName(sale.ContactName);
            var provision = await provisioner.EnsureUserAsync(email, new ProvisionProfile(
                FirstName: firstName,
                LastName: lastName,
                Phone: sale.MobileNumber ?? string.Empty,
                Dob: sale.DateOfBirth ?? string.Empty,
                Tfn: sale.Tfn ?? string.Empty,
                Address: sale.Address ?? string.Empty,
                Suburb: sale.Suburb ?? string.Empty,
                State: sale.State ?? string.Empty,
                Postcode: sale.Postcode ?? string.Empty), ct);
            if (provision.User is null)
                throw new InvalidOperationException($"could not create portal user: {provision.Error}");

            userId = provision.User.Id;
            createdLogin = provision.Created;
            log.UserId = userId;
            log.Outcome = provision.Created ? ProvisionOutcome.Created : ProvisionOutcome.Updated;
            log.Detail = null;
        }

        // The name they paid to renew, with its current due date.
        var names = await context.BusinessNames.Where(b => b.UserId == userId).ToListAsync(ct);
        var bn = names.FirstOrDefault(b => string.Equals(b.Name.Trim(), name, StringComparison.OrdinalIgnoreCase));
        if (bn is null)
        {
            bn = new BusinessName { UserId = userId, Name = name, RenewalDate = sale.RenewalDueDate ?? string.Empty };
            context.BusinessNames.Add(bn);
        }
        else if (string.IsNullOrEmpty(bn.RenewalDate) && !string.IsNullOrEmpty(sale.RenewalDueDate))
        {
            bn.RenewalDate = sale.RenewalDueDate;
        }

        var row = await context.BusinessNameRenewals.FirstOrDefaultAsync(r => r.RenewtronSaleId == sale.Id, ct);
        if (sale.RenewalRequestId is { } renewalId)
        {
            // Renewtron has created the renewal. If an earlier sync already mirrored
            // it as its own row, fold this sale into that one.
            var renewalRow = await context.BusinessNameRenewals.FirstOrDefaultAsync(r => r.RenewtronRenewalId == renewalId, ct);
            if (renewalRow is not null && renewalRow != row)
            {
                if (row is not null) context.BusinessNameRenewals.Remove(row);
                renewalRow.RenewtronSaleId = sale.Id;
                await context.SaveChangesAsync(ct);
                return createdLogin;
            }
        }

        if (row is null)
        {
            row = new BusinessNameRenewal { UserId = userId, RenewtronSaleId = sale.Id, Reference = sale.Id.ToString() };
            context.BusinessNameRenewals.Add(row);
        }
        row.BusinessName = name;
        row.BusinessNameId = bn.Id;
        row.Abn = sale.Abn?.Trim() ?? string.Empty;
        row.Years = sale.RenewalYears;
        row.Source = "Ontraport";
        row.RenewedAt = new DateTimeOffset(DateTime.SpecifyKind(sale.SyncedAt, DateTimeKind.Utc));

        if (sale.RenewalRequestId is { } id)
        {
            // From here the renewal mirror owns the status.
            row.RenewtronRenewalId = id;
        }
        else
        {
            (row.Status, row.StatusMessage) = sale.Status switch
            {
                "NotDueForRenewal" or "IneligibleForRenewal" or "RenewalFailed" =>
                    ("Failed", "This renewal needs attention from our team — we'll be in touch."),
                "RenewalInProgress" => ("Processing", (string?)null),
                "AsicNotYetDue" =>
                    ("Scheduled", "ASIC isn't accepting this renewal yet — we'll lodge it as soon as it opens."),
                _ => ("Scheduled", "Paid — we'll lodge it with ASIC as soon as its renewal window opens."),
            };
        }

        await context.SaveChangesAsync(ct);
        return createdLogin;
    }

    /// <summary>Pull the status of every ASIC key request still open with Renewtron.</summary>
    private async Task RefreshKeyRequestsAsync(CancellationToken ct)
    {
        var open = await context.BusinessNames
            .Where(b => b.AsicKeyRequestId != null
                        && b.AsicKeyRequestStatus != "KeyReceived" && b.AsicKeyRequestStatus != "Failed")
            .ToListAsync(ct);

        foreach (var bn in open)
        {
            var state = await client.GetAsicKeyRequestAsync(bn.AsicKeyRequestId!.Value, ct);
            if (state?.Status is { Length: > 0 } status)
                bn.AsicKeyRequestStatus = status;
        }
        await context.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Fill in ASIC keys Renewtron has retrieved from ASIC's notification emails.
    ///
    /// An ASIC key lets whoever holds it change the registration, and anyone can add
    /// any business name (or type any ABN — they're public) into their portal. So a
    /// matching name is not proof of ownership. The one thing that is: the customer
    /// paid Renewtron to renew that exact name, which is the same basis Renewtron
    /// already hands keys to its customers on. Those keys are applied directly.
    /// A key for a name the customer only *requested* is held in PendingAsicKey for
    /// staff to verify and apply from the client page. Keys nobody asked for are ignored.
    /// </summary>
    private async Task<int> ApplyAsicKeysAsync(CancellationToken ct)
    {
        var keys = (await client.GetAsicKeysAsync(DateTime.UtcNow - KeyWindow, ct))
            .Where(k => !string.IsNullOrWhiteSpace(k.AsicKey) && !string.IsNullOrWhiteSpace(k.BusinessName))
            .ToList();
        if (keys.Count == 0) return 0;

        var wanted = keys.Select(k => k.BusinessName!.Trim().ToLower()).Distinct().ToList();
        var candidates = await context.BusinessNames
            .Where(b => b.AsicKey == "" && b.PendingAsicKey == null && wanted.Contains(b.Name.Trim().ToLower()))
            .ToListAsync(ct);
        if (candidates.Count == 0) return 0;

        var userIds = candidates.Select(b => b.UserId).Distinct().ToList();
        var renewed = await context.BusinessNameRenewals.AsNoTracking()
            .Where(r => userIds.Contains(r.UserId) && r.RenewtronRenewalId != null && r.Status == "Completed")
            .Select(r => new { r.UserId, r.BusinessName })
            .ToListAsync(ct);

        var applied = 0;
        foreach (var bn in candidates)
        {
            var key = keys
                .Where(k => string.Equals(k.BusinessName!.Trim(), bn.Name.Trim(), StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(k => k.ReceivedAt)
                .First();

            var paidForByThisCustomer = renewed.Any(r =>
                r.UserId == bn.UserId && string.Equals(r.BusinessName.Trim(), bn.Name.Trim(), StringComparison.OrdinalIgnoreCase));

            if (paidForByThisCustomer)
            {
                bn.AsicKey = key.AsicKey!.Trim();
                if (bn.AsicKeyRequestId is not null) bn.AsicKeyRequestStatus = "KeyReceived";
                applied++;
            }
            else if (bn.AsicKeyRequestId is not null)
            {
                bn.PendingAsicKey = key.AsicKey!.Trim();
                bn.AsicKeyRequestStatus = "KeyReceived";
                logger.LogInformation("ASIC key for {BusinessName} (user {UserId}) held for staff verification", bn.Name, bn.UserId);
            }
        }

        await context.SaveChangesAsync(ct);
        return applied;
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
            // A login that was already made stays made — only the mirror step failed.
            if (log.Outcome is not (ProvisionOutcome.Created or ProvisionOutcome.Updated))
            {
                log.Outcome = ProvisionOutcome.Failed;
                log.Attempts++;
            }
            log.Detail = error.Length > 2000 ? error[..2000] : error;
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
