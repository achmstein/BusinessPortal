namespace BusinessPortal.Application.AsicRenewals.Queries.GetAsicRenewals;

public record AsicRenewalDto
{
    public Guid SourceId { get; init; }
    public string Kind { get; init; } = "Business Name";
    public string Name { get; init; } = string.Empty;
    public string Identifier { get; init; } = string.Empty;
    public string DueDate { get; init; } = string.Empty;
    public int DaysUntil { get; init; }
    public string Tone { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
}
