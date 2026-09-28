using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure.Data;
using BusinessPortal.Infrastructure.Ato;
using BusinessPortal.Infrastructure.Data.Interceptors;
using BusinessPortal.Infrastructure.ExternalClients;
using BusinessPortal.Infrastructure.Identity;
using BusinessPortal.Infrastructure.Jobs;
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
                // 8+ characters, no composition requirements. Length beats
                // symbol-juggling for memorability, and the original 6 was low
                // for accounts holding a TFN. Existing passwords keep working —
                // this applies when one is set or changed. Keep in step with the
                // rule the reset and register screens state.
                options.Password.RequiredLength = 8;
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

        // Reset links double as the set-your-password invite for auto-provisioned
        // accounts (Renewtron/Ontraport), which sits in an inbox longer than a
        // just-requested reset — 48h covers both. Tokens still die early when the
        // password changes (they embed the security stamp). Keep in step with
        // ResendEmailSender.TokenTtl (the "expires in …" email copy).
        services.Configure<DataProtectionTokenProviderOptions>(options =>
            options.TokenLifespan = TimeSpan.FromHours(48));

        // ─── Email (Resend adapter; console-logs when no API key is configured) ───
        // Registered as itself too: the invite email (SendInviteAsync) isn't part
        // of Identity's IEmailSender<TUser> contract.
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));
        services.AddHttpClient(ResendEmailSender.HttpClientName);
        services.AddSingleton<ResendEmailSender>();
        services.AddSingleton<IEmailSender<ApplicationUser>>(sp => sp.GetRequiredService<ResendEmailSender>());

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

        // ─── Auto-provisioned portal logins (from Renewtron renewals) ───
        services.AddScoped<UserProvisioningService>();

        // ─── Renewtron completed-renewal sync (recurring job + admin "sync now") ───
        services.Configure<Renewtron.RenewtronOptions>(configuration.GetSection(Renewtron.RenewtronOptions.SectionName));
        services.AddHttpClient<Renewtron.RenewtronClient>();
        services.AddScoped<IRenewtronSyncService, Renewtron.RenewtronSyncService>();

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
