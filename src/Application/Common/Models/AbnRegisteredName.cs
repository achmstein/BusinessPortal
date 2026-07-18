namespace BusinessPortal.Application.Common.Models;

/// <summary>A business name registered to an ABN, as returned by the ABN Lookup
/// gateway. Ported from lib/abn-lookup.ts AbnRegisteredName.</summary>
public record AbnRegisteredName
{
    public string Abn { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string State { get; init; } = string.Empty;
    public string DateRegistered { get; init; } = string.Empty;
    public string CancelledAt { get; init; } = string.Empty;
    public string RenewalDate { get; init; } = string.Empty;
}
