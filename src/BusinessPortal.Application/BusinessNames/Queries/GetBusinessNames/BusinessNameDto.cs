namespace BusinessPortal.Application.BusinessNames.Queries.GetBusinessNames;

public record BusinessNameDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string DateRegistered { get; init; } = string.Empty;
    public string RenewalDate { get; init; } = string.Empty;
    public string AsicKey { get; init; } = string.Empty;
    public DateTimeOffset Created { get; init; }

    public static BusinessNameDto FromEntity(BusinessName b) => new()
    {
        Id = b.Id,
        Name = b.Name,
        DateRegistered = b.DateRegistered,
        RenewalDate = b.RenewalDate,
        AsicKey = b.AsicKey,
        Created = b.Created,
    };
}
