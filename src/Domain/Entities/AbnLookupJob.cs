namespace BusinessPortal.Domain.Entities;

/// <summary>Status of the last (or currently-running) ABN Lookup job for a user.
/// Ported from the original <c>user.abnLookupJob</c>. The background worker updates
/// <see cref="AbnsProcessed"/> as it goes so the UI can show progress.</summary>
public class AbnLookupJob : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public AbnLookupStatus Status { get; set; } = AbnLookupStatus.Running;
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public int TotalAbns { get; set; }
    public int AbnsProcessed { get; set; }
    public int AddedCount { get; set; }
    public int EnrichedCount { get; set; }
    public string? Error { get; set; }
}
