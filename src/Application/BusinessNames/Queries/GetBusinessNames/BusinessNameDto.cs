namespace BusinessPortal.Application.BusinessNames.Queries.GetBusinessNames;

public record BusinessNameDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string DateRegistered { get; init; } = string.Empty;
    public string RenewalDate { get; init; } = string.Empty;
    public string AsicKey { get; init; } = string.Empty;
    public DateTimeOffset Created { get; init; }

    /// <summary>Renewtron key request state; KeyReceived while staff verify a held key.</summary>
    public string? AsicKeyRequestStatus { get; init; }
    public DateTimeOffset? AsicKeyRequestedAt { get; init; }

    public static BusinessNameDto FromEntity(BusinessName b) => new()
    {
        Id = b.Id,
        Name = b.Name,
        DateRegistered = b.DateRegistered,
        RenewalDate = b.RenewalDate,
        AsicKey = b.AsicKey,
        Created = b.Created,
        AsicKeyRequestStatus = b.AsicKeyRequestStatus,
        AsicKeyRequestedAt = b.AsicKeyRequestedAt,
    };
}
