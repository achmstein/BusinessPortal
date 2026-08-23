namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>2Captcha API key for the ASIC Connect scraper, editable from the admin Settings UI.</summary>
public sealed record TwoCaptchaSettings(string? ApiKey);

/// <summary>Shared-secret headers for the two inbound Ontraport rules, editable from the admin Settings UI.
/// Empty = that webhook refuses every request.</summary>
public sealed record OntraportWebhookSettings(string? WebhookSecret, string? RenewalSecret);

/// <summary>Outbound email (Resend) settings, editable from the admin Settings UI.
/// With no API key, emails are logged to the console instead of sent.</summary>
public sealed record EmailSettings(string? From, string? ResendApiKey, string? SiteUrl);

/// <summary>ABN Lookup (ABR web services) token, editable from the admin Settings UI.</summary>
public sealed record AbnLookupSettings(string? ApiToken);

/// <summary>Renewtron (businessnames.applyforanabn.au) admin-API access for the
/// completed-renewal sync, editable from the admin Settings UI.
/// Empty API key = the sync is off.</summary>
public sealed record RenewtronSettings(string? BaseUrl, string? ApiKey);

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

    OntraportWebhookSettings GetOntraportWebhookSettings();

    Task UpdateOntraportWebhookSettingsAsync(OntraportWebhookSettings settings, CancellationToken cancellationToken);

    EmailSettings GetEmailSettings();

    Task UpdateEmailSettingsAsync(EmailSettings settings, CancellationToken cancellationToken);

    AbnLookupSettings GetAbnLookupSettings();

    Task UpdateAbnLookupSettingsAsync(AbnLookupSettings settings, CancellationToken cancellationToken);

    RenewtronSettings GetRenewtronSettings();

    Task UpdateRenewtronSettingsAsync(RenewtronSettings settings, CancellationToken cancellationToken);
}
