using System.Text.Json;
using BusinessPortal.Application.Common.Interfaces;

namespace BusinessPortal.Web.Endpoints;

/// <summary>Inbound Ontraport webhooks. Public (no cookie auth) — gated by the
/// X-Ontraport-Secret shared-secret header, which each rule sets.</summary>
public static class OntraportEndpoints
{
    public static IEndpointRouteBuilder MapOntraportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/integrations/ontraport").WithTags("Ontraport");

        group.MapPost("/webhook", async (HttpRequest req, IOntraportService svc, CancellationToken ct) =>
        {
            if (!svc.VerifyWebhookSecret(req.Headers["X-Ontraport-Secret"].ToString()))
                return Results.Json(new { ok = false, error = "unauthorized" }, statusCode: 401);

            Dictionary<string, string> payload;
            try { payload = await ReadPayloadAsync(req); }
            catch { return Results.Json(new { ok = false, error = "bad request" }, statusCode: 400); }

            var result = await svc.SyncContactAsync(payload, ct);
            return Results.Json(result.Body, statusCode: result.Status);
        });

        group.MapPost("/renewal-paid", async (HttpRequest req, IOntraportService svc, CancellationToken ct) =>
        {
            if (!svc.VerifyRenewalSecret(req.Headers["X-Ontraport-Secret"].ToString()))
                return Results.Json(new { ok = false, error = "unauthorized" }, statusCode: 401);

            Dictionary<string, string> payload;
            try { payload = await ReadPayloadAsync(req); }
            catch { return Results.Json(new { ok = false, error = "bad request" }, statusCode: 400); }

            var result = await svc.ProcessRenewalPaidAsync(payload, ct);
            return Results.Json(result.Body, statusCode: result.Status);
        });

        return app;
    }

    /// <summary>Ontraport rules send form-urlencoded by default; JSON is also accepted.</summary>
    private static async Task<Dictionary<string, string>> ReadPayloadAsync(HttpRequest req)
    {
        var dict = new Dictionary<string, string>(StringComparer.Ordinal);

        if (req.HasFormContentType)
        {
            var form = await req.ReadFormAsync();
            foreach (var kv in form)
                dict[kv.Key] = kv.Value.ToString();
            return dict;
        }

        using var doc = await JsonDocument.ParseAsync(req.Body);
        if (doc.RootElement.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                dict[prop.Name] = prop.Value.ValueKind == JsonValueKind.String
                    ? (prop.Value.GetString() ?? string.Empty)
                    : prop.Value.ToString();
            }
        }

        return dict;
    }
}
