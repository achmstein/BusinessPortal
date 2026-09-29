namespace BusinessPortal.Domain.Entities;

/// <summary>A one-click sign-in link that has been used. The jti is the primary
/// key, so a link can sign someone in exactly once however many times it's
/// clicked (or forwarded).</summary>
public class SignInLinkRedemption
{
    public string Jti { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public DateTimeOffset RedeemedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
