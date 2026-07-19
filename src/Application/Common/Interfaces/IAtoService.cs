namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>An agent (business) the linked myID user can act for.</summary>
public record AtoAgentDto(string Name, string Abn, string Ran);

public record AtoLinkStartResult(Guid AttemptId, string ReferenceCode);

public enum AtoLinkStatus { Pending, Linked, Failed, Expired }

/// <summary>Result of one poll of an in-progress link. <see cref="AtoLinkStatus.Pending"/>
/// means "keep polling"; <see cref="AtoLinkStatus.Linked"/> carries the agent list for the
/// ABN picker.</summary>
public record AtoPollResult(AtoLinkStatus Status, IReadOnlyList<AtoAgentDto> Agents, string? Reason);

/// <summary>Outcome of the auto-orchestration that runs after the user picks their ABN.
/// <see cref="Nomination"/> is one of "submitted" | "already_nominated" | "failed".</summary>
public record AtoSelectResult(bool Connected, int SyncedCount, string Nomination);

public record AtoSyncResult(bool Ok, int SyncedCount, bool NeedsRelink, string? Reason);

public record AtoStatusResult(bool Connected, DateTimeOffset? NominatedAt, string? NominatedFromAbn);

/// <summary>The real ATO myID integration: link (OAuth chain), sync businesses from OSfB,
/// nominate us as tax agent, unlink. UNVERIFIED end-to-end — needs a live myID account.
/// Implemented in Infrastructure over the ATO auth client + encrypted session stores.</summary>
public interface IAtoService
{
    /// <summary>Begin the myID OAuth chain: returns an attempt id + 4-digit code to show
    /// the user (which they approve in their myID app).</summary>
    Task<AtoLinkStartResult> StartLinkAsync(string userId, string email, CancellationToken ct);

    /// <summary>Poll an in-progress link once. Returns Pending until the user approves,
    /// then Linked (session saved) with the agent list, or Failed/Expired.</summary>
    Task<AtoPollResult> PollLinkAsync(string userId, Guid attemptId, CancellationToken ct);

    /// <summary>After the user picks their ABN: mark connected, sync businesses, nominate us.</summary>
    Task<AtoSelectResult> SelectAgentAsync(string userId, string abn, CancellationToken ct);

    /// <summary>Pull every business the user can act for from OSfB and upsert into entities.</summary>
    Task<AtoSyncResult> SyncBusinessesAsync(string userId, CancellationToken ct);

    /// <summary>Drop the stored session and mark the user disconnected.</summary>
    Task UnlinkAsync(string userId, CancellationToken ct);

    Task<AtoStatusResult> GetStatusAsync(string userId, CancellationToken ct);
}
