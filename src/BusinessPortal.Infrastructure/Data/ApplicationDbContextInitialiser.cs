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

    /// <summary>Seed the admin account from <c>SeedAdmin:Email/Password</c> config
    /// (mirrors the original app's single admin). Idempotent.</summary>
    private async Task TrySeedAsync()
    {
        var email = configuration["SeedAdmin:Email"] ?? "admin@businessportal.local";
        var password = configuration["SeedAdmin:Password"] ?? "Admin!23456";

        if (await userManager.FindByEmailAsync(email) is not null)
            return;

        var admin = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            IsAdmin = true,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        var result = await userManager.CreateAsync(admin, password);
        if (!result.Succeeded)
        {
            logger.LogWarning("Seed admin '{Email}' not created: {Errors}",
                email, string.Join("; ", result.Errors.Select(e => e.Description)));
        }
        else
        {
            logger.LogInformation("Seeded admin user '{Email}'.", email);
        }
    }
}
