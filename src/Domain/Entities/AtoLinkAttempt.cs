namespace BusinessPortal.Domain.Entities;

/// <summary>An in-progress ATO link attempt. Holds the encrypted AuthFlowState between
/// beginAuth and waitForApproval. Short-lived (~10 min), torn down after the link
/// succeeds or a new attempt starts. Ported from the original Prisma AtoLinkAttempt.</summary>
public class AtoLinkAttempt : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public string StateEncrypted { get; set; } = string.Empty; // AES-256-GCM of AuthFlowState JSON
    public string ReferenceCode { get; set; } = string.Empty;  // 4-digit code shown to the user
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
