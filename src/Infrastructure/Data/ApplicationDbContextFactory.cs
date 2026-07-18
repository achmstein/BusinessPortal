using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BusinessPortal.Infrastructure.Data;

/// <summary>Design-time factory so <c>dotnet ef migrations</c> can build the context
/// without the Web host. Uses a localhost Postgres connection string — only ever
/// used by the CLI, never at runtime.</summary>
public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("BUSINESSPORTAL_DB")
            ?? "Host=localhost;Port=5432;Database=businessportal;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new ApplicationDbContext(options);
    }
}
