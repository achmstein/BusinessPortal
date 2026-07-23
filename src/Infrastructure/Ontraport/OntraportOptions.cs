namespace BusinessPortal.Infrastructure.Ontraport;

/// <summary>Shared-secret headers for the two Ontraport rules. Bound from the
/// "Ontraport" config section — entered from the admin Settings UI (persisted to
/// the overrides file), or via env: Ontraport__WebhookSecret /
/// Ontraport__RenewalSecret. Empty = that webhook refuses every request.</summary>
public class OntraportOptions
{
    public const string SectionName = "Ontraport";

    public string? WebhookSecret { get; set; }
    public string? RenewalSecret { get; set; }
}
