namespace BusinessPortal.Domain.Entities;

/// <summary>One email the portal tried to send: who to, what kind, and whether the
/// provider accepted it. Deliberately no subject/body — welcome emails carry
/// one-click sign-in links, which are credentials and must not sit in a table.</summary>
public class EmailLog : BaseEntity
{
    /// <summary>The account it was about, when known.</summary>
    public string? UserId { get; set; }

    public string To { get; set; } = string.Empty;

    /// <summary>Welcome | PasswordReset | Confirmation.</summary>
    public string Kind { get; set; } = string.Empty;

    /// <summary>Sent (provider accepted it) | Failed | NotConfigured (no provider key —
    /// logged to the console only).</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>The provider's error, trimmed, when it failed.</summary>
    public string? Error { get; set; }

    public DateTimeOffset At { get; set; }
}
