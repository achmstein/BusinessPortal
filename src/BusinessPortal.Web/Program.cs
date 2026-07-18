using System.Text.Json.Serialization;
using BusinessPortal.Application;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure;
using BusinessPortal.Infrastructure.Data;
using BusinessPortal.Infrastructure.Identity;
using BusinessPortal.Web.Endpoints;
using BusinessPortal.Web.Infrastructure;
using BusinessPortal.Web.Services;
using Microsoft.AspNetCore.Identity;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUser, CurrentUser>();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddExceptionHandler<CustomExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

// Serialize enums as strings both ways (so the SPA sees "Company", not 3).
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

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
}

app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

// Built-in Identity endpoints: /api/login, /api/register, /api/refresh, etc.
app.MapGroup("/api").MapIdentityApi<ApplicationUser>();

app.MapAccountEndpoints();
app.MapProfileEndpoints();
app.MapBusinessEntitiesEndpoints();
app.MapBusinessNamesEndpoints();
app.MapMessagesEndpoints();
app.MapAsicRenewalsEndpoints();
app.MapAdminEndpoints();

app.MapDefaultEndpoints();

// Client-side routing fallback (serves index.html for non-API routes in production).
app.MapFallbackToFile("index.html");

app.Run();
