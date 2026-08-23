namespace BusinessPortal.Infrastructure.Renewtron;

/// <summary>Access to Renewtron's admin API (the ASIC business-name renewal
/// service) for the completed-renewal sync. Bound from the "Renewtron" config
/// section — base URL + API key are entered from the admin Settings UI (persisted
/// to the overrides file). Empty API key = the sync is off, matching the
/// empty-secret-means-disabled convention used across the integrations.</summary>
public class RenewtronOptions
{
    public const string SectionName = "Renewtron";

    /// <summary>e.g. https://businessnames.applyforanabn.au</summary>
    public string? BaseUrl { get; set; }

    /// <summary>Sent as the X-Api-Key header (Renewtron's machine-caller scheme).</summary>
    public string? ApiKey { get; set; }

    /// <summary>How far back (by initiation date) each run scans for completed
    /// renewals. Wide on purpose: renewals can complete days after initiation via
    /// Renewtron's auto-retry/reconciliation, and the provision log makes
    /// re-scanning free.</summary>
    public int PollWindowDays { get; set; } = 90;

    /// <summary>Give up retrying a failing renewal after this many attempts.</summary>
    public int MaxAttempts { get; set; } = 10;
}
