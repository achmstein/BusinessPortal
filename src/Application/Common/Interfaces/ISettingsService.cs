namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>2Captcha API key for the ASIC Connect scraper, editable from the admin Settings UI.</summary>
public sealed record TwoCaptchaSettings(string? ApiKey);

/// <summary>Outbound email settings, editable from the admin Settings UI. Resend
/// or SendGrid (Resend wins when both keys are set); with no API key, emails are
/// logged to the console instead of sent.</summary>
public sealed record EmailSettings(string? From, string? ResendApiKey, string? SendGridApiKey, string? SiteUrl);

/// <summary>ABN Lookup (ABR web services) token, editable from the admin Settings UI.</summary>
public sealed record AbnLookupSettings(string? ApiToken);

/// <summary>Renewtron (businessnames.applyforanabn.au): its partner API is the
/// portal's source for renewals and ASIC keys, and its site is the renewal
/// checkout. The API key is Renewtron's scoped partner key. Empty key = off.</summary>
public sealed record RenewtronSettings(string? BaseUrl, string? ApiKey, string? CheckoutUrl);

/// <summary>
/// Reads and persists the integration credentials that used to be server-only
/// (appsettings/environment). Reads reflect the live configuration (including
/// runtime overrides); writes are persisted to a writable overrides file that the
/// configuration system reloads, so changes take effect without a restart.
/// </summary>
public interface ISettingsService
{
    TwoCaptchaSettings GetTwoCaptchaSettings();

    Task UpdateTwoCaptchaSettingsAsync(TwoCaptchaSettings settings, CancellationToken cancellationToken);

    EmailSettings GetEmailSettings();

    Task UpdateEmailSettingsAsync(EmailSettings settings, CancellationToken cancellationToken);

    AbnLookupSettings GetAbnLookupSettings();

    Task UpdateAbnLookupSettingsAsync(AbnLookupSettings settings, CancellationToken cancellationToken);

    RenewtronSettings GetRenewtronSettings();

    Task UpdateRenewtronSettingsAsync(RenewtronSettings settings, CancellationToken cancellationToken);
}
