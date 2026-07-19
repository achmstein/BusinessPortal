namespace BusinessPortal.Infrastructure.Asic;

/// <summary>Base error for the ASIC Connect scraper.</summary>
public class AsicScrapeError(string message) : Exception(message);

/// <summary>Thrown when a scrape is attempted but no 2Captcha key is configured.
/// Callers gate on <see cref="AsicRegistryClient.IsConfigured"/> to avoid this.</summary>
public sealed class TwoCaptchaNotConfigured()
    : AsicScrapeError("ASIC_2CAPTCHA_API_KEY is not set — ASIC Connect search needs a 2Captcha key.");

/// <summary>The 2Captcha solve failed or timed out.</summary>
public sealed class CaptchaSolveFailed(string reason) : AsicScrapeError($"2Captcha solve failed: {reason}");
