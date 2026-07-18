namespace BusinessPortal.Domain.Entities;

/// <summary>An ASIC-registered business name tracked for a client. Renewal dates
/// come from ASIC Connect; <see cref="AsicKey"/> is user-entered.
/// <see cref="RenewalTransactionIds"/> makes the renewal-paid webhook idempotent.</summary>
public class BusinessName : BaseAuditableEntity
{
    public string UserId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string DateRegistered { get; set; } = string.Empty;
    public string RenewalDate { get; set; } = string.Empty;
    public string AsicKey { get; set; } = string.Empty;

    /// <summary>Ontraport transaction ids already applied, so a retried
    /// renewal-paid webhook doesn't extend the date twice.</summary>
    public List<string> RenewalTransactionIds { get; set; } = [];
}
