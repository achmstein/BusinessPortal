namespace BusinessPortal.Domain.Entities;

/// <summary>Audit trail for the admin "impersonate this client" feature. One row per
/// impersonation start; <see cref="EndedAt"/> is stamped on exit or logout. While the
/// row's EndedAt is null the impersonation session is considered active.</summary>
public class ImpersonationLog : BaseEntity
{
    public string AdminUserId { get; set; } = string.Empty;
    public string TargetUserId { get; set; } = string.Empty;
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public string? Reason { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}
