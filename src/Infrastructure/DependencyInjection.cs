using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure.Data;
using BusinessPortal.Infrastructure.Ato;
using BusinessPortal.Infrastructure.Data.Interceptors;
using BusinessPortal.Infrastructure.ExternalClients;
using BusinessPortal.Infrastructure.Identity;
using BusinessPortal.Infrastructure.Jobs;
using BusinessPortal.Infrastructure.Ontraport;
using BusinessPortal.Infrastructure.Services;
using Hangfire;
using Hangfire.PostgreSql;
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

        // This is an API behind a SPA — return 401/403 instead of redirecting to a
        // server-rendered login page (there isn't one). The SPA owns the auth UI.
        services.ConfigureApplicationCookie(options =>
        {
            options.Events.OnRedirectToLogin = ctx =>
            {
                ctx.Response.StatusCode = 401;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = ctx =>
            {
                ctx.Response.StatusCode = 403;
                return Task.CompletedTask;
            };
        });

        services.AddAuthorization(options =>
            options.AddPolicy("Admin", policy => policy.RequireRole(Roles.Admin)));

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.SignIn.RequireConfirmedAccount = false;
                // Match the original portal's password rule: 6+ characters, no
                // composition requirements (register enforced only length >= 6).
                options.Password.RequiredLength = 6;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders()
            .AddApiEndpoints();

        // Password-reset links promise "expires in 1 hour" (original PasswordReset TTL).
        services.Configure<DataProtectionTokenProviderOptions>(options =>
            options.TokenLifespan = TimeSpan.FromHours(1));

        // ─── Email (Resend adapter; console-logs when no API key is configured) ───
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));
        services.AddHttpClient(ResendEmailSender.HttpClientName);
        services.AddSingleton<IEmailSender<ApplicationUser>, ResendEmailSender>();

        // ─── Hangfire (background jobs, stored in the same Postgres DB) ───
        services.AddHangfire(cfg => cfg
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(o => o.UseNpgsqlConnection(connectionString)));
        services.AddHangfireServer();
        services.AddScoped<IJobScheduler, HangfireJobScheduler>();

        // ─── ABN Lookup (data.gov.au) ───
        services.AddHttpClient<IAbnLookupClient, AbnLookupClient>();
        services.AddScoped<IAbnLookupService, AbnLookupService>();

        // ─── ASIC Connect scraper (renewal-date enrichment; gated on a 2Captcha key) ───
        services.AddHttpClient("asic-2captcha");
        services.AddScoped<Asic.AsicCaptchaSolver>();
        services.AddScoped<IAsicRegistryClient, Asic.AsicRegistryClient>();

        // ─── Ontraport webhooks ───
        services.Configure<OntraportOptions>(configuration.GetSection(OntraportOptions.SectionName));
        services.AddScoped<IOntraportService, OntraportService>();

        // ─── Admin-editable integration settings (persisted to the overrides file) ───
        services.AddSingleton<ISettingsService, Settings.SettingsService>();

        // ─── ATO myID auth client + encrypted session/attempt stores + orchestrator ───
        services.AddScoped<AtoAuthClient>();
        services.AddScoped<AtoCookieStore>();
        services.AddScoped<AtoAttemptStore>();
        services.AddScoped<IAtoService, AtoService>();

        return services;
    }
}
