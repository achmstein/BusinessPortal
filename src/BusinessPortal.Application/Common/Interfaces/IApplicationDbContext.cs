using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>The Application layer's view of persistence — just the aggregates it
/// needs, plus SaveChanges. Implemented by Infrastructure's ApplicationDbContext.
/// Identity users are reached through UserManager, not this context.</summary>
public interface IApplicationDbContext
{
    DbSet<BusinessEntity> BusinessEntities { get; }
    DbSet<BusinessName> BusinessNames { get; }
    DbSet<Message> Messages { get; }
    DbSet<ImpersonationLog> ImpersonationLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
