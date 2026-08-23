using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure.Identity;
using BusinessPortal.Infrastructure.Ontraport;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Infrastructure.Settings;

/// <summary>
/// Ported from Asictron's SettingsService: reads integration credentials from the
/// live configuration (via IOptionsMonitor / IConfiguration, so runtime overrides
/// are reflected) and persists edits to a writable overrides file.
/// appsettings.json is never touched — it ships inside the read-only image; the
/// overrides file is layered on top in Program.cs and reloaded on change.
/// </summary>
public sealed class SettingsService : ISettingsService
{
    // IOptionsMonitor (not IOptions) so reads reflect writes made below — IOptions
    // caches the value captured at startup and never sees reloadOnChange refreshes.
    private readonly IOptionsMonitor<OntraportOptions> _ontraport;
    private readonly IOptionsMonitor<EmailOptions> _email;
    private readonly IOptionsMonitor<Renewtron.RenewtronOptions> _renewtron;
    private readonly IConfiguration _configuration;
    private readonly string _overridesPath;

    public SettingsService(
        IOptionsMonitor<OntraportOptions> ontraport,
        IOptionsMonitor<EmailOptions> email,
        IOptionsMonitor<Renewtron.RenewtronOptions> renewtron,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        _ontraport = ontraport;
        _email = email;
        _renewtron = renewtron;
        _configuration = configuration;

        // Match Program.cs: the writable overrides file lives outside the image.
        _overridesPath = configuration["Storage:OverridesPath"]
            ?? Path.Combine(environment.ContentRootPath, "settings.overrides.json");
    }

    public TwoCaptchaSettings GetTwoCaptchaSettings() =>
        // Mirror AsicCaptchaSolver's lookup: config key first, then the legacy env var.
        new(_configuration["Asic:TwoCaptchaApiKey"]?.Trim() is { Length: > 0 } k ? k
            : Environment.GetEnvironmentVariable("ASIC_2CAPTCHA_API_KEY")?.Trim() is { Length: > 0 } e ? e
            : null);

    public Task UpdateTwoCaptchaSettingsAsync(TwoCaptchaSettings settings, CancellationToken cancellationToken) =>
        UpdateSectionAsync("Asic", new
        {
            TwoCaptchaApiKey = settings.ApiKey?.Trim(),
        }, cancellationToken);

    public OntraportWebhookSettings GetOntraportWebhookSettings()
    {
        var o = _ontraport.CurrentValue;
        return new OntraportWebhookSettings(o.WebhookSecret, o.RenewalSecret);
    }

    public Task UpdateOntraportWebhookSettingsAsync(OntraportWebhookSettings settings, CancellationToken cancellationToken) =>
        UpdateSectionAsync(OntraportOptions.SectionName, new
        {
            WebhookSecret = settings.WebhookSecret?.Trim(),
            RenewalSecret = settings.RenewalSecret?.Trim(),
        }, cancellationToken);

    public EmailSettings GetEmailSettings()
    {
        var e = _email.CurrentValue;
        return new EmailSettings(e.From, e.ResendApiKey, e.SendGridApiKey, e.SiteUrl);
    }

    public Task UpdateEmailSettingsAsync(EmailSettings settings, CancellationToken cancellationToken) =>
        UpdateSectionAsync(EmailOptions.SectionName, new
        {
            From = settings.From?.Trim(),
            ResendApiKey = settings.ResendApiKey?.Trim(),
            SendGridApiKey = settings.SendGridApiKey?.Trim(),
            SiteUrl = settings.SiteUrl?.Trim(),
        }, cancellationToken);

    public AbnLookupSettings GetAbnLookupSettings() =>
        new(_configuration["AbnLookup:ApiToken"]?.Trim() is { Length: > 0 } t ? t : null);

    public Task UpdateAbnLookupSettingsAsync(AbnLookupSettings settings, CancellationToken cancellationToken) =>
        UpdateSectionAsync("AbnLookup", new
        {
            ApiToken = settings.ApiToken?.Trim(),
        }, cancellationToken);

    public RenewtronSettings GetRenewtronSettings()
    {
        var r = _renewtron.CurrentValue;
        return new RenewtronSettings(r.BaseUrl, r.ApiKey);
    }

    public Task UpdateRenewtronSettingsAsync(RenewtronSettings settings, CancellationToken cancellationToken) =>
        UpdateSectionAsync(Renewtron.RenewtronOptions.SectionName, new
        {
            BaseUrl = settings.BaseUrl?.Trim().TrimEnd('/'),
            ApiKey = settings.ApiKey?.Trim(),
        }, cancellationToken);

    private async Task UpdateSectionAsync(string sectionName, object section, CancellationToken cancellationToken)
    {
        // Load existing overrides if present, else start fresh. Merge at the section
        // level so unrelated sections (written by other Save actions) are preserved.
        JsonObject root;
        if (File.Exists(_overridesPath))
        {
            var existing = await File.ReadAllTextAsync(_overridesPath, cancellationToken);
            root = JsonNode.Parse(existing) as JsonObject ?? new JsonObject();
        }
        else
        {
            root = new JsonObject();
            var dir = Path.GetDirectoryName(_overridesPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }
        }

        var sectionJson = JsonSerializer.Serialize(section);
        root[sectionName] = JsonNode.Parse(sectionJson);

        var writeOptions = new JsonSerializerOptions
        {
            WriteIndented = true,
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        };
        await File.WriteAllTextAsync(_overridesPath, JsonSerializer.Serialize(root, writeOptions), cancellationToken);
    }
}
