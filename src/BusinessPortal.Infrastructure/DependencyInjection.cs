using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure.Data;
using BusinessPortal.Infrastructure.Data.Interceptors;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BusinessPortal.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("BusinessPortalDb")
            ?? configuration.GetConnectionString("DefaultConnection");

        // ─── EF Core (PostgreSQL) ───
        services.AddScoped<ISaveChangesInterceptor, AuditableEntityInterceptor>();

        services.AddDbContext<ApplicationDbContext>((sp, options) =>
        {
            options.UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure(
                maxRetryCount: 6, maxRetryDelay: TimeSpan.FromSeconds(10), errorCodesToAdd: null));
            options.AddInterceptors(sp.GetServices<ISaveChangesInterceptor>());
        });

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());
        services.AddScoped<ApplicationDbContextInitialiser>();

        // ─── ASP.NET Identity (cookie auth) ───
        services.AddAuthentication(IdentityConstants.ApplicationScheme)
            .AddIdentityCookies();
        services.AddAuthorization();

        services.AddIdentityCore<ApplicationUser>(options => options.SignIn.RequireConfirmedAccount = false)
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders()
            .AddApiEndpoints();

        services.AddSingleton<IEmailSender<ApplicationUser>, NoOpEmailSender>();

        return services;
    }
}
