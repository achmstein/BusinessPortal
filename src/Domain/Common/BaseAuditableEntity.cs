namespace BusinessPortal.Domain.Common;

/// <summary>Adds create/modify auditing. Stamped automatically by the
/// AuditableEntityInterceptor in Infrastructure. <see cref="Created"/> doubles as
/// the original app's <c>createdAt</c>.</summary>
public abstract class BaseAuditableEntity : BaseEntity
{
    public DateTimeOffset Created { get; set; }
    public string? CreatedBy { get; set; }
    public DateTimeOffset LastModified { get; set; }
    public string? LastModifiedBy { get; set; }
}
