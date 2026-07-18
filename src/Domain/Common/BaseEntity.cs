namespace BusinessPortal.Domain.Common;

/// <summary>Root of every persisted domain entity. Uses a client-generated Guid id
/// (matches the original app, where ids were generated in application code).</summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
}
