namespace BusinessPortal.Domain.Entities;

/// <summary>A business in the client's multi-entity portfolio (the original
/// <c>Entity</c> type — renamed to avoid colliding with EF/base "entity" terms).
/// ACN is only populated for Company/Trust. The ATO-sourced fields are filled by
/// the business sync.</summary>
public class BusinessEntity : BaseAuditableEntity
{
    // Owner (ASP.NET Identity user id).
    public string UserId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public EntityType EntityType { get; set; } = EntityType.Unspecified;
    public string Abn { get; set; } = string.Empty;
    public string Acn { get; set; } = string.Empty;
    public string Industry { get; set; } = string.Empty;
    public int Employees { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;

    // ─── Populated when synced from ATO ───
    public string? LegalName { get; set; }
    public string? Tfn { get; set; }
    public string? ClientAccountId { get; set; }
    public DateTimeOffset? AtoNominatedAt { get; set; }
    public EntitySource Source { get; set; } = EntitySource.Manual;
    public DateTimeOffset? SyncedAt { get; set; }
}
