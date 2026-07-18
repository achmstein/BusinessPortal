using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace BusinessPortal.Infrastructure.Data.Interceptors;

/// <summary>Stamps Created/CreatedBy/LastModified/LastModifiedBy on every
/// <see cref="BaseAuditableEntity"/> as it is saved. <c>Created</c> is the original
/// app's <c>createdAt</c>.</summary>
public class AuditableEntityInterceptor(IUser user) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        UpdateEntities(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        UpdateEntities(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void UpdateEntities(DbContext? context)
    {
        if (context is null) return;

        var now = DateTimeOffset.UtcNow;
        foreach (var entry in context.ChangeTracker.Entries<BaseAuditableEntity>())
        {
            if (entry.State is EntityState.Added or EntityState.Modified || entry.HasChangedOwnedEntities())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.Entity.CreatedBy = user.Id;
                    entry.Entity.Created = now;
                }

                entry.Entity.LastModifiedBy = user.Id;
                entry.Entity.LastModified = now;
            }
        }
    }
}

public static class AuditableEntityExtensions
{
    public static bool HasChangedOwnedEntities(this EntityEntry entry) =>
        entry.References.Any(r =>
            r.TargetEntry != null &&
            r.TargetEntry.Metadata.IsOwned() &&
            r.TargetEntry.State is EntityState.Added or EntityState.Modified);
}
