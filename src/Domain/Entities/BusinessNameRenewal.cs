namespace BusinessPortal.Domain.Entities;

/// <summary>A completed, paid business-name renewal — the customer's purchase
/// history. Written by the Ontraport renewal-paid webhook and the Renewtron sync
/// wherever they extend a renewal date. <see cref="BusinessName"/> is a snapshot so
/// the record survives the name being removed or cancelled later.</summary>
public class BusinessNameRenewal : BaseAuditableEntity
{
    public string UserId { get; set; } = string.Empty;

    public Guid? BusinessNameId { get; set; }
    public string BusinessName { get; set; } = string.Empty;

    public int Years { get; set; }

    /// <summary>The renewal date after this renewal was applied (yyyy-MM-dd).</summary>
    public string NewRenewalDate { get; set; } = string.Empty;

    /// <summary>"Ontraport" | "Renewtron" | "Imported".</summary>
    public string Source { get; set; } = string.Empty;

    /// <summary>Payment transaction id or Renewtron renewal id.</summary>
    public string Reference { get; set; } = string.Empty;

    public DateTimeOffset RenewedAt { get; set; }
}
