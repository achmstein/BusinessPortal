using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.Ato;

/// <summary>Orchestrates the real ATO myID integration end-to-end: the OAuth link flow,
/// the OSfB business sync, and agent nomination — composing the auth client + encrypted
/// session/attempt stores. Mirrors the original link/actions.ts + nominate-actions.ts.
/// UNVERIFIED against a live myID account.</summary>
public sealed class AtoService(
    AtoAuthClient authClient,
    AtoCookieStore cookieStore,
    AtoAttemptStore attemptStore,
    UserManager<ApplicationUser> userManager,
    IApplicationDbContext db,
    ILogger<AtoService> logger) : IAtoService
{
    // Each poll HTTP call bounds the internal approval-wait so the request returns quickly;
    // the SPA re-polls. The attempt row's own TTL bounds the overall window.
    private const int PerCallPollTimeoutMs = 20_000;

    public async Task<AtoLinkStartResult> StartLinkAsync(string userId, string email, CancellationToken ct)
    {
        await attemptStore.PurgeExpiredAsync(userId, ct);
        var begin = await authClient.BeginAuthAsync(email, ct);
        var attemptId = await attemptStore.SaveAsync(userId, begin.State, begin.ReferenceCode, ct: ct);
        logger.LogInformation("ATO link started for user {UserId}, attempt {AttemptId}", userId, attemptId);
        return new AtoLinkStartResult(attemptId, begin.ReferenceCode);
    }

    public async Task<AtoPollResult> PollLinkAsync(string userId, Guid attemptId, CancellationToken ct)
    {
        var attempt = await attemptStore.LoadAsync(attemptId, userId, ct);
        if (attempt is null)
            return new AtoPollResult(AtoLinkStatus.Expired, [], "Link attempt expired — please start again.");

        try
        {
            var result = await authClient.WaitForApprovalAsync(
                attempt.State, timeoutMs: PerCallPollTimeoutMs, pollIntervalMs: AtoConstants.PollIntervalMs, ct);

            await cookieStore.SaveAsync(userId, attempt.State.Email, result.CookiesJson, result.Agents, ct: ct);
            await attemptStore.DeleteAsync(attemptId, ct);

            var agents = result.Agents.Select(a => new AtoAgentDto(a.Name, a.Abn, a.Ran)).ToList();
            logger.LogInformation("ATO link succeeded for user {UserId} — {Count} agent(s)", userId, agents.Count);
            return new AtoPollResult(AtoLinkStatus.Linked, agents, null);
        }
        catch (ApprovalTimedOut)
        {
            // Not approved within this call's window — the SPA polls again.
            return new AtoPollResult(AtoLinkStatus.Pending, [], null);
        }
        catch (AtoAuthError e)
        {
            logger.LogWarning(e, "ATO link failed for user {UserId}", userId);
            await attemptStore.DeleteAsync(attemptId, ct);
            return new AtoPollResult(AtoLinkStatus.Failed, [], e.Message);
        }
    }

    public async Task<AtoSelectResult> SelectAgentAsync(string userId, string abn, CancellationToken ct)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return new AtoSelectResult(false, 0, "failed");

        user.AtoConnected = true;
        await userManager.UpdateAsync(user);

        // Both steps are best-effort — a failure here must not undo the successful link.
        var synced = 0;
        try { synced = (await SyncBusinessesAsync(userId, ct)).SyncedCount; }
        catch (Exception ex) { logger.LogError(ex, "ATO auto-sync after link failed for {UserId}", userId); }

        var nomination = "failed";
        try { nomination = await NominateInternalAsync(userId, abn, ct); }
        catch (Exception ex) { logger.LogError(ex, "ATO auto-nominate after link failed for {UserId}", userId); }

        return new AtoSelectResult(true, synced, nomination);
    }

    public async Task<AtoSyncResult> SyncBusinessesAsync(string userId, CancellationToken ct)
    {
        var session = await cookieStore.LoadForUserAsync(userId, ct);
        if (session is null)
            return new AtoSyncResult(false, 0, NeedsRelink: true, "No ATO session — link first.");

        using var http = new AtoHttp(AtoHttp.DeserializeJar(session.CookiesJson));
        var details = await AtoBusinesses.PullAllAsync(http, seedAbns: null, logger, ct);

        var existing = await db.BusinessEntities.Where(e => e.UserId == userId).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        foreach (var d in details)
        {
            var norm = DigitsOnly(d.Abn);
            var entity = existing.FirstOrDefault(x => DigitsOnly(x.Abn) == norm);
            if (entity is null)
            {
                entity = new BusinessEntity
                {
                    UserId = userId,
                    Abn = d.Abn,
                    Name = d.DisplayName,
                    EntityType = d.EntityTypeName == "Company" ? EntityType.Company : EntityType.Unspecified,
                    Acn = d.Acn ?? string.Empty,
                };
                db.BusinessEntities.Add(entity);
                existing.Add(entity);
            }
            // Overwrite ATO-sourced fields; preserve manual ones (industry/phone/website/employees/name).
            entity.LegalName = d.LegalName;
            if (!string.IsNullOrEmpty(d.Tfn)) entity.Tfn = d.Tfn;
            if (!string.IsNullOrEmpty(d.ClientAccountId)) entity.ClientAccountId = d.ClientAccountId;
            if (!string.IsNullOrEmpty(d.Acn)) entity.Acn = d.Acn;
            if (d.EntityTypeName == "Company") entity.EntityType = EntityType.Company;
            entity.Source = EntitySource.Ato;
            entity.SyncedAt = now;
        }
        await db.SaveChangesAsync(ct);

        // Persist refreshed cookies (ATO may rotate the CSRF token mid-flow).
        await cookieStore.SaveAsync(userId, session.Email, AtoHttp.SerializeJar(http.Jar), session.Agents, ct: ct);
        logger.LogInformation("ATO sync for user {UserId} upserted {Count} business(es)", userId, details.Count);
        return new AtoSyncResult(true, details.Count, false, null);
    }

    public async Task UnlinkAsync(string userId, CancellationToken ct)
    {
        await cookieStore.DeleteForUserAsync(userId, ct);
        var user = await userManager.FindByIdAsync(userId);
        if (user is not null)
        {
            user.AtoConnected = false;
            await userManager.UpdateAsync(user);
        }
        logger.LogInformation("ATO unlinked for user {UserId}", userId);
    }

    public async Task<AtoStatusResult> GetStatusAsync(string userId, CancellationToken ct)
    {
        var user = await userManager.FindByIdAsync(userId);
        return user is null
            ? new AtoStatusResult(false, null, null)
            : new AtoStatusResult(user.AtoConnected, user.AtoNominatedAt, user.AtoNominatedFromAbn);
    }

    /// <summary>Look up our agent by RAN, submit the nomination, stamp the user.
    /// Idempotent — returns "already_nominated" if a prior
    /// nomination already succeeded. Returns "submitted" | "already_nominated" | "failed".</summary>
    private async Task<string> NominateInternalAsync(string userId, string abn, CancellationToken ct)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return "failed";
        if (user.AtoNominatedAt is not null) return "already_nominated";

        var session = await cookieStore.LoadForUserAsync(userId, ct);
        if (session is null) return "failed";

        using var http = new AtoHttp(AtoHttp.DeserializeJar(session.CookiesJson));
        var ran = AtoConstants.OurAgentRan();
        var lookup = await AtoNominate.LookupAgentByRanAsync(http, ran, abn, ct);
        var result = await AtoNominate.NominateAgentAsync(http, lookup.Agent, abn, ct);

        var now = DateTimeOffset.UtcNow;
        user.AtoNominatedAt = now;
        user.AtoNominatedFromAbn = abn;
        await userManager.UpdateAsync(user);

        await cookieStore.SaveAsync(userId, session.Email, AtoHttp.SerializeJar(http.Jar), session.Agents, ct: ct);
        logger.LogInformation("ATO nomination {Status} for user {UserId} via ABN {Abn}", result.Status, userId, abn);
        return result.Status == NominationStatus.AlreadyNominated ? "already_nominated" : "submitted";
    }

    private static string DigitsOnly(string s) => new(s.Where(char.IsDigit).ToArray());
}
