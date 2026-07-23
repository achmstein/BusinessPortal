using BusinessPortal.Application.Common.Interfaces;

namespace BusinessPortal.Web.Endpoints;

/// <summary>Admin-editable integration settings (2Captcha, Ontraport webhook
/// secrets, email, ABN Lookup). Persisted to the writable overrides file on the
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

        // Ontraport webhook shared secrets (X-Ontraport-Secret header values).
        group.MapGet("/ontraport", (ISettingsService settings) =>
                Results.Ok(settings.GetOntraportWebhookSettings()))
            .WithName("GetOntraportSettings").Produces<OntraportWebhookSettings>();

        group.MapPut("/ontraport", async (OntraportWebhookSettings body, ISettingsService settings, CancellationToken ct) =>
            {
                await settings.UpdateOntraportWebhookSettingsAsync(body, ct);
                return Results.NoContent();
            })
            .WithName("UpdateOntraportSettings").Produces(StatusCodes.Status204NoContent);

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

        return app;
    }
}
