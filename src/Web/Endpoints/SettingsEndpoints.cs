using BusinessPortal.Application.Common.Interfaces;

namespace BusinessPortal.Web.Endpoints;

/// <summary>Admin-editable integration settings (2Captcha, email, ABN Lookup,
/// Renewtron). Persisted to the writable overrides file on the
/// data volume — see SettingsService. Modelled on Asictron's SettingsEndpoints,
/// but gated by the Admin role like the rest of the console.</summary>
public static class SettingsEndpoints
{
    public static IEndpointRouteBuilder MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/settings")
            .WithTags("Settings")
            .RequireAuthorization("Admin");

        // 2Captcha API key — solves the reCAPTCHA on ASIC Connect lookups.
        group.MapGet("/captcha", (ISettingsService settings) =>
                Results.Ok(settings.GetTwoCaptchaSettings()))
            .WithName("GetCaptchaSettings").Produces<TwoCaptchaSettings>();

        group.MapPut("/captcha", async (TwoCaptchaSettings body, ISettingsService settings, CancellationToken ct) =>
            {
                await settings.UpdateTwoCaptchaSettingsAsync(body, ct);
                return Results.NoContent();
            })
            .WithName("UpdateCaptchaSettings").Produces(StatusCodes.Status204NoContent);

        // Outbound email via Resend (console-logs when no API key is set).
        group.MapGet("/email", (ISettingsService settings) =>
                Results.Ok(settings.GetEmailSettings()))
            .WithName("GetEmailSettings").Produces<EmailSettings>();

        group.MapPut("/email", async (EmailSettings body, ISettingsService settings, CancellationToken ct) =>
            {
                await settings.UpdateEmailSettingsAsync(body, ct);
                return Results.NoContent();
            })
            .WithName("UpdateEmailSettings").Produces(StatusCodes.Status204NoContent);

        // ABN Lookup (ABR web services) token.
        group.MapGet("/abn-lookup", (ISettingsService settings) =>
                Results.Ok(settings.GetAbnLookupSettings()))
            .WithName("GetAbnLookupSettings").Produces<AbnLookupSettings>();

        group.MapPut("/abn-lookup", async (AbnLookupSettings body, ISettingsService settings, CancellationToken ct) =>
            {
                await settings.UpdateAbnLookupSettingsAsync(body, ct);
                return Results.NoContent();
            })
            .WithName("UpdateAbnLookupSettings").Produces(StatusCodes.Status204NoContent);

        // Renewtron partner API + checkout — drives the renewal/ASIC-key sync.
        group.MapGet("/renewtron", (ISettingsService settings) =>
                Results.Ok(settings.GetRenewtronSettings()))
            .WithName("GetRenewtronSettings").Produces<RenewtronSettings>();

        group.MapPut("/renewtron", async (RenewtronSettings body, ISettingsService settings, CancellationToken ct) =>
            {
                await settings.UpdateRenewtronSettingsAsync(body, ct);
                return Results.NoContent();
            })
            .WithName("UpdateRenewtronSettings").Produces(StatusCodes.Status204NoContent);

        // Run the sync in the request so the admin sees the outcome immediately;
        // the same service runs on the recurring Hangfire schedule. Safe to overlap
        // with the schedule — every step is idempotent.
        group.MapPost("/renewtron/sync-now", async (IRenewtronSyncService sync, CancellationToken ct) =>
                Results.Ok(await sync.SyncAsync(ct)))
            .WithName("RunRenewtronSyncNow").Produces<RenewtronSyncResult>();

        return app;
    }
}
