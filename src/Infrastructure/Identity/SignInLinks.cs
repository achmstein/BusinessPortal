using BusinessPortal.Domain.Services;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Infrastructure.Identity;

/// <summary>One-click sign-in links ("auto login"). The signing key is shared with
/// Renewtron (Portal__MagicLinkSigningKey there, SignInLinks__SigningKey here) so
/// its renewal confirmation email can carry a link too. Empty key = feature off:
/// emails fall back to the set-password / sign-in links.</summary>
public class SignInLinkOptions
{
    public const string SectionName = "SignInLinks";

    public string? SigningKey { get; set; }

    /// <summary>How long an emailed link stays valid. Renewtron issues 72h links.</summary>
    public int LifetimeHours { get; set; } = 72;

    /// <summary>At least 32 characters — shorter keys are treated as unset.</summary>
    public bool IsConfigured => SigningKey is { Length: >= 32 };
}

public class SignInLinks(IOptionsMonitor<SignInLinkOptions> options, IOptionsMonitor<EmailOptions> email)
{
    public bool IsConfigured => options.CurrentValue.IsConfigured;

    /// <summary>A link that signs <paramref name="emailAddress"/> in once, or null when
    /// the feature is off.</summary>
    public string? CreateUrl(string emailAddress)
    {
        var o = options.CurrentValue;
        var site = email.CurrentValue.SiteUrl?.TrimEnd('/');
        if (!o.IsConfigured || string.IsNullOrEmpty(site)) return null;

        var token = SignInLinkToken.Create(
            emailAddress, o.SigningKey!, DateTimeOffset.UtcNow.AddHours(o.LifetimeHours), Guid.NewGuid());
        return $"{site}/auth/link?t={Uri.EscapeDataString(token)}";
    }

    public SignInLinkToken.Failure Read(string? token, out SignInLinkToken.Claims? claims)
    {
        var o = options.CurrentValue;
        if (!o.IsConfigured)
        {
            claims = null;
            return SignInLinkToken.Failure.Malformed;
        }
        return SignInLinkToken.TryRead(token, o.SigningKey!, DateTimeOffset.UtcNow, out claims);
    }
}
