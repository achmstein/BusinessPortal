namespace BusinessPortal.Domain.Entities;

/// <summary>One completed Renewtron renewal the sync has seen. The unique
/// <see cref="RenewalId"/> makes polling idempotent: a renewal is provisioned once,
/// and only <see cref="ProvisionOutcome.Failed"/> rows are retried (up to
/// <see cref="Attempts"/> cap).</summary>
public class RenewtronProvisionLog : BaseAuditableEntity
{
    /// <summary>Renewtron's RenewalRequest id.</summary>
    public Guid RenewalId { get; set; }

    public string Email { get; set; } = string.Empty;
    public string BusinessName { get; set; } = string.Empty;
    public string Abn { get; set; } = string.Empty;

    /// <summary>"Renewtron" | "Ontraport" | "BulkUpload" — as reported by the API.</summary>
    public string Source { get; set; } = string.Empty;

    public ProvisionOutcome Outcome { get; set; }

    /// <summary>Skip reason or the last error message.</summary>
    public string? Detail { get; set; }

    /// <summary>Portal user this renewal was applied to, when provisioned.</summary>
    public string? UserId { get; set; }

    public int Attempts { get; set; }
    public DateTimeOffset ProcessedAt { get; set; }
}
