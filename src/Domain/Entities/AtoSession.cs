namespace BusinessPortal.Domain.Entities;

/// <summary>A successful, authenticated ATO myID session. <see cref="CookiesEncrypted"/>
/// is AES-256-GCM-wrapped cookie-jar JSON (lossless). Ported from the original Prisma
/// AtoSession. Unique per (user, myID email).</summary>
public class AtoSession : BaseEntity
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;          // myID email
    public string CookiesEncrypted { get; set; } = string.Empty;
    public string AgentsJson { get; set; } = "[]";             // cached agent list (JSON array)
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
