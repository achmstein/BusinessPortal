using System.Reflection;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Infrastructure.Data;

/// <summary>EF Core context. Extends <see cref="IdentityDbContext{TUser}"/> so the
/// Identity tables live alongside the app's, and implements
/// <see cref="IApplicationDbContext"/> so the Application layer depends only on the
/// abstraction. Entity configs are discovered from this assembly.</summary>
public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser>(options), IApplicationDbContext
{
    public DbSet<BusinessEntity> BusinessEntities => Set<BusinessEntity>();
    public DbSet<BusinessName> BusinessNames => Set<BusinessName>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<ImpersonationLog> ImpersonationLogs => Set<ImpersonationLog>();
    public DbSet<AbnLookupJob> AbnLookupJobs => Set<AbnLookupJob>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
