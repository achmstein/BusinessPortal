using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.Data;

public static class InitialiserExtensions
{
    /// <summary>Migrate + seed at startup. Called from the Web host's Program.cs.</summary>
    public static async Task InitialiseDatabaseAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var initialiser = scope.ServiceProvider.GetRequiredService<ApplicationDbContextInitialiser>();
        await initialiser.InitialiseAsync();
        await initialiser.SeedAsync();
    }
}

public class ApplicationDbContextInitialiser(
    ILogger<ApplicationDbContextInitialiser> logger,
    ApplicationDbContext context,
    UserManager<ApplicationUser> userManager,
    RoleManager<IdentityRole> roleManager,
    IConfiguration configuration)
{
    public async Task InitialiseAsync()
    {
        try
        {
            await context.Database.MigrateAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while migrating the database.");
            throw;
        }
    }

    public async Task SeedAsync()
    {
        try
        {
            await TrySeedAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while seeding the database.");
            throw;
        }
    }

    /// <summary>Seed the Admin role + admin account from <c>SeedAdmin:Email/Password</c>
    /// config. There is no fallback: locally it comes from appsettings.Development.json,
    /// in production from deploy secrets, and without one no admin is created — a known
    /// default would be a public login. Idempotent — safe to run every startup.</summary>
    private async Task TrySeedAsync()
    {
        if (!await roleManager.RoleExistsAsync(Roles.Admin))
            await roleManager.CreateAsync(new IdentityRole(Roles.Admin));

        var email = configuration["SeedAdmin:Email"];
        var password = configuration["SeedAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("No admin seeded: set SeedAdmin:Email and SeedAdmin:Password.");
            return;
        }

        var admin = await userManager.FindByEmailAsync(email);
        if (admin is null)
        {
            admin = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                CreatedAt = DateTimeOffset.UtcNow,
            };

            var result = await userManager.CreateAsync(admin, password);
            if (!result.Succeeded)
            {
                logger.LogWarning("Seed admin '{Email}' not created: {Errors}",
                    email, string.Join("; ", result.Errors.Select(e => e.Description)));
                return;
            }

            logger.LogInformation("Seeded admin user '{Email}'.", email);
        }

        if (!await userManager.IsInRoleAsync(admin, Roles.Admin))
            await userManager.AddToRoleAsync(admin, Roles.Admin);
    }
}
