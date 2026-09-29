namespace BusinessPortal.Domain.Entities;

/// <summary>A business-name renewal the customer has paid for, mirrored from
/// Renewtron — which takes the payment and renews the name at ASIC — from the
/// moment it's paid until ASIC confirms it. <see cref="BusinessName"/> is a
/// snapshot so the record survives the name being removed or cancelled later.
/// Rows imported from the old confirmation messages have no Renewtron id.</summary>
public class BusinessNameRenewal : BaseAuditableEntity
{
    public string UserId { get; set; } = string.Empty;

    public Guid? BusinessNameId { get; set; }
    public string BusinessName { get; set; } = string.Empty;

    /// <summary>The ABN Renewtron renewed the name under — ownership evidence when
    /// matching ASIC keys to this customer.</summary>
    public string Abn { get; set; } = string.Empty;

    public int Years { get; set; }

    /// <summary>The renewal date after this renewal was applied (yyyy-MM-dd);
    /// empty until it completes.</summary>
    public string NewRenewalDate { get; set; } = string.Empty;

    /// <summary>"Renewtron" | "Ontraport" | "BulkUpload" | "Imported".</summary>
    public string Source { get; set; } = string.Empty;

    /// <summary>Payment transaction id or Renewtron renewal id (legacy rows).</summary>
    public string Reference { get; set; } = string.Empty;

    /// <summary>When it completed at ASIC — or, while in progress, when it was paid.</summary>
    public DateTimeOffset RenewedAt { get; set; }

    // ─── Live state from Renewtron ───
    public Guid? RenewtronRenewalId { get; set; }

    /// <summary>The paid Ontraport sale this row started from, before Renewtron
    /// created the renewal; RenewtronRenewalId is filled once it does.</summary>
    public Guid? RenewtronSaleId { get; set; }

    /// <summary>Scheduled (paid, waiting for ASIC's renewal window) | Pending |
    /// Processing | Completed | Failed.</summary>
    public string Status { get; set; } = "Completed";

    /// <summary>Customer-safe explanation from Renewtron when delayed or failed.</summary>
    public string? StatusMessage { get; set; }

    /// <summary>ASIC's transaction reference — the customer's proof of renewal.</summary>
    public string? TransactionReference { get; set; }
}
