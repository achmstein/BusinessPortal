namespace BusinessPortal.Application.Common.Models;

/// <summary>A business-name record scraped from the ASIC Connect registry — the real
/// registration + renewal dates and status that the public data.gov.au feed doesn't carry.
/// Dates are normalised to ISO "yyyy-MM-dd" (empty when ASIC didn't show one). Ported from
/// the original lib/asic-connect AsicBusinessName.</summary>
public record AsicBusinessName
{
    public string Name { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string DateRegistered { get; init; } = string.Empty;
    public string RenewalDate { get; init; } = string.Empty;
    public IReadOnlyList<string> Holders { get; init; } = [];
}
