using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using BusinessPortal.Application;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure;
using BusinessPortal.Infrastructure.Data;
using BusinessPortal.Infrastructure.Identity;
using BusinessPortal.Web.Endpoints;
using BusinessPortal.Web.Infrastructure;
using BusinessPortal.Web.Services;
using Hangfire;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Writable overrides layer for runtime-mutable settings (2Captcha key, Renewtron
// partner key, email credentials — edited from the admin Settings UI). Lives
// outside the immutable container image so SettingsService can persist admin
// changes; reloadOnChange flushes IOptionsMonitor consumers automatically, so
// edits take effect without a restart. Added last, so it overrides appsettings.*
// and environment variables for the keys it sets.
var overridesPath = builder.Configuration["Storage:OverridesPath"]
    ?? Path.Combine(builder.Environment.ContentRootPath, "settings.overrides.json");
builder.Configuration.AddJsonFile(overridesPath, optional: true, reloadOnChange: true);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUser, CurrentUser>();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Data Protection also encrypts the stored ATO session cookies / link-attempt state
// (AtoCookieStore / AtoAttemptStore), so register it unconditionally with a stable app
// name. In production, persist keys to a mounted volume so both the auth cookie and the
// ATO blobs survive container redeploys (KeysDirectory set by the compose deploy).
var dataProtection = builder.Services.AddDataProtection().SetApplicationName("BusinessPortal");
var keysDirectory = builder.Configuration["DataProtection:KeysDirectory"];
if (!string.IsNullOrWhiteSpace(keysDirectory))
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(keysDirectory));

builder.Services.AddExceptionHandler<CustomExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

// Serialize enums as strings both ways (so the SPA sees "Company", not 3).
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Same budget as the original registerAction: 5 signups per hour per IP.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("register", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromHours(1) }));
    // Sign-in links: 20 attempts per 10 minutes per IP is plenty for real clicks
    // and useless for guessing (tokens are HMAC-signed anyway).
    options.AddPolicy("sign-in-link", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(10) }));
    options.OnRejected = async (context, ct) =>
    {
        var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry)
            ? (int)retry.TotalSeconds
            : 3600;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            $"{{\"error\":\"Too many attempts. Try again in {retryAfter}s.\"}}", ct);
    };
});

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "https://localhost:5173"];

builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(allowedOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

// Migrate + seed on startup (Postgres is provided by Aspire / the compose stack).
await app.Services.InitialiseDatabaseAsync();

app.UseExceptionHandler();

// Serve the built React SPA (populated in wwwroot on publish; empty in dev where Vite serves it).
app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // interactive API reference at /scalar
}

app.UseCors();
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

// Hangfire dashboard — admins only.
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = [new HangfireDashboardAuthorizationFilter()],
});

// Poll Renewtron for completed business-name renewals and provision portal logins.
// No-ops (and says so) until the Renewtron API key is set in admin Settings.
// Every step is idempotent, so this can safely overlap the admin "sync now" button.
RecurringJob.AddOrUpdate<IRenewtronSyncService>(
    "renewtron-renewal-sync",
    sync => sync.SyncAsync(CancellationToken.None),
    "*/10 * * * *");

// Built-in Identity endpoints: /api/login, /api/register, /api/refresh, etc.
app.MapGroup("/api").MapIdentityApi<ApplicationUser>();

app.MapAccountEndpoints();
app.MapProfileEndpoints();
app.MapBusinessEntitiesEndpoints();
app.MapBusinessNamesEndpoints();
app.MapMessagesEndpoints();
app.MapAsicRenewalsEndpoints();
app.MapAbnLookupEndpoints();
app.MapAdminEndpoints();
app.MapSettingsEndpoints();
app.MapRenewtronEndpoints();
app.MapAtoEndpoints();

app.MapDefaultEndpoints();

// Client-side routing fallback (serves index.html for non-API routes in production).
app.MapFallbackToFile("index.html");

app.Run();
