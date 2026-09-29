namespace BusinessPortal.Infrastructure.Renewtron;

/// <summary>Access to Renewtron's partner API (the ASIC business-name renewal
/// service) and its public checkout. Bound from the "Renewtron" config
/// section — base URL + API key are entered from the admin Settings UI (persisted
/// to the overrides file). Empty API key = the sync is off, matching the
/// empty-secret-means-disabled convention used across the integrations.</summary>
public class RenewtronOptions
{
    public const string SectionName = "Renewtron";

    /// <summary>e.g. https://businessnames.applyforanabn.au</summary>
    public string? BaseUrl { get; set; }

    /// <summary>Where customers are sent to renew (Renewtron's public wizard). Empty =
    /// BaseUrl, which suits a single public host; set it when BaseUrl is the
    /// internal address (same server / Docker network) so API calls stay private.</summary>
    public string? CheckoutUrl { get; set; }

    public string? PublicCheckoutUrl =>
        (string.IsNullOrWhiteSpace(CheckoutUrl) ? BaseUrl : CheckoutUrl)?.Trim().TrimEnd('/') is { Length: > 0 } url ? url : null;

    /// <summary>Renewtron's scoped partner key, sent as X-Api-Key. It can read
    /// renewals and raise ASIC key requests — not Renewtron's admin API.</summary>
    public string? ApiKey { get; set; }

    /// <summary>How far back (by initiation date) each run scans for completed
    /// renewals. Wide on purpose: renewals can complete days after initiation via
    /// Renewtron's auto-retry/reconciliation, and the provision log makes
    /// re-scanning free.</summary>
    public int PollWindowDays { get; set; } = 90;

    /// <summary>Only customers from this date on (UTC): renewals started and Ontraport
    /// sales first seen on or after it. Lets the integration go live for new customers
    /// without creating accounts for — and emailing — everyone who renewed before.
    /// Empty = the full poll window.</summary>
    public DateTime? SyncFrom { get; set; }

    /// <summary>The earliest date a run looks at: the poll window, cut off by SyncFrom.</summary>
    public DateTime EffectiveSince(DateTime utcNow)
    {
        var window = utcNow.AddDays(-Math.Max(1, PollWindowDays)).Date;
        return SyncFrom is { } from && from.Date > window ? from.Date : window;
    }

    /// <summary>Give up retrying a failing renewal after this many attempts.</summary>
    public int MaxAttempts { get; set; } = 10;
}
