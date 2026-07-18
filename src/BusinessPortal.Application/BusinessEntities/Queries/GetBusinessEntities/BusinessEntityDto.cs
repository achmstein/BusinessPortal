namespace BusinessPortal.Application.BusinessEntities.Queries.GetBusinessEntities;

/// <summary>Wire shape for a business entity. Enums are stringified so the SPA
/// gets "Company" rather than 3. Hand-mapped via <see cref="FromEntity"/>.</summary>
public record BusinessEntityDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string EntityType { get; init; } = string.Empty;
    public string Abn { get; init; } = string.Empty;
    public string Acn { get; init; } = string.Empty;
    public string Industry { get; init; } = string.Empty;
    public int Employees { get; init; }
    public string Phone { get; init; } = string.Empty;
    public string Website { get; init; } = string.Empty;
    public string? LegalName { get; init; }
    public string? Tfn { get; init; }
    public string Source { get; init; } = string.Empty;
    public DateTimeOffset Created { get; init; }

    public static BusinessEntityDto FromEntity(BusinessEntity e) => new()
    {
        Id = e.Id,
        Name = e.Name,
        EntityType = e.EntityType.ToString(),
        Abn = e.Abn,
        Acn = e.Acn,
        Industry = e.Industry,
        Employees = e.Employees,
        Phone = e.Phone,
        Website = e.Website,
        LegalName = e.LegalName,
        Tfn = e.Tfn,
        Source = e.Source.ToString(),
        Created = e.Created,
    };
}
