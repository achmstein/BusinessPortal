namespace BusinessPortal.Domain.Entities;

/// <summary>An ASIC-registered business name tracked for a client. Renewal dates
/// come from ASIC Connect or Renewtron; <see cref="AsicKey"/> is user-entered or
/// delivered by Renewtron's ASIC key pipeline.
/// <see cref="RenewalTransactionIds"/> makes applying a renewal idempotent.</summary>
public class BusinessName : BaseAuditableEntity
{
    public string UserId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string DateRegistered { get; set; } = string.Empty;
    public string RenewalDate { get; set; } = string.Empty;
    public string AsicKey { get; set; } = string.Empty;

    /// <summary>Renewal markers already applied ("renewtron:{id}", and legacy
    /// Ontraport transaction ids), so a renewal never extends the date twice.</summary>
    public List<string> RenewalTransactionIds { get; set; } = [];

    // ─── ASIC key request raised through Renewtron ───
    public Guid? AsicKeyRequestId { get; set; }
    public DateTimeOffset? AsicKeyRequestedAt { get; set; }

    /// <summary>Renewtron's request status: Pending, Manual, Submitted, KeyReceived, Failed.</summary>
    public string? AsicKeyRequestStatus { get; set; }

    /// <summary>A key Renewtron retrieved for a name this customer requested but
    /// hasn't renewed through Renewtron — held for staff to verify ownership before
    /// it's applied. Never sent to the client.</summary>
    public string? PendingAsicKey { get; set; }
}
