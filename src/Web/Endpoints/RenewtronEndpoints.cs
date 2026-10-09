using System.Security.Claims;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure.Identity;
using BusinessPortal.Infrastructure.Renewtron;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Web.Endpoints;

public record CheckoutResponse(string Url);
public record AsicKeyRequestResponse(string Status, DateTimeOffset? RequestedAt);
public record AsicDocumentResponse(Guid Id, string Kind, string Title, DateTimeOffset ReceivedAt);

/// <summary>The customer-facing side of the Renewtron integration: renewing through
/// Renewtron's checkout (Stripe, which starts the ASIC renewal immediately),
/// asking Renewtron to retrieve an ASIC key, and downloading ASIC's letters.</summary>
public static class RenewtronEndpoints
{
    public static IEndpointRouteBuilder MapRenewtronEndpoints(this IEndpointRouteBuilder app)
    {
        // Link into Renewtron's wizard, prefilled with what the portal already knows
        // so the customer isn't asked twice. The wizard looks the ABN up at ASIC and
        // lists every name on it that's due, so this works for any of their names.
        app.MapGet("/api/asic-renewals/checkout", async (
                Guid? businessNameId, ClaimsPrincipal principal, UserManager<ApplicationUser> users,
                IApplicationDbContext context, IOptionsMonitor<RenewtronOptions> options, CancellationToken ct) =>
            {
                var siteUrl = options.CurrentValue.PublicCheckoutUrl;
                if (string.IsNullOrEmpty(siteUrl))
                    return Results.Problem("Online renewal isn't available right now.", statusCode: StatusCodes.Status503ServiceUnavailable);

                var user = await users.GetUserAsync(principal);
                if (user is null) return Results.Unauthorized();

                string? nameText = null;
                if (businessNameId is { } bnId)
                    nameText = await context.BusinessNames.AsNoTracking()
                        .Where(b => b.Id == bnId && b.UserId == user.Id).Select(b => b.Name).FirstOrDefaultAsync(ct);

                var p = user.Profile;
                var query = new Dictionary<string, string?>
                {
                    ["abn"] = await AbnForAsync(context, user, nameText, ct),
                    ["name"] = $"{p.FirstName} {p.LastName}".Trim(),
                    ["email"] = user.Email,
                    ["mobile"] = p.Phone,
                    ["dob"] = p.Dob,
                    ["source"] = "portal",
                };
                var qs = string.Join("&", query
                    .Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
                    .Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value!.Trim())}"));
                return Results.Ok(new CheckoutResponse($"{siteUrl}/?{qs}"));
            })
            .RequireAuthorization()
            .WithTags("ASIC Renewals")
            .WithName("GetRenewalCheckout")
            .Produces<CheckoutResponse>();

        // Ask Renewtron to have ASIC send a copy of the key. Renewtron submits ASIC's
        // enquiry form and reads the key from ASIC's reply; the sync brings it back.
        app.MapPost("/api/business-names/{id:guid}/request-asic-key", async (
                Guid id, ClaimsPrincipal principal, UserManager<ApplicationUser> users,
                IApplicationDbContext context, RenewtronClient renewtron, IRenewtronSyncService sync, CancellationToken ct) =>
            {
                var user = await users.GetUserAsync(principal);
                if (user is null) return Results.Unauthorized();

                var bn = await context.BusinessNames.FirstOrDefaultAsync(b => b.Id == id && b.UserId == user.Id, ct);
                if (bn is null) return Results.NotFound();
                if (!string.IsNullOrEmpty(bn.AsicKey))
                    return Results.BadRequest(new ErrorResponse("This business name already has an ASIC key."));
                if (!renewtron.IsConfigured)
                    return Results.Problem("ASIC key requests aren't available right now.", statusCode: StatusCodes.Status503ServiceUnavailable);

                var p = user.Profile;
                // ASIC's enquiry form needs a name and phone for the person asking.
                if (string.IsNullOrWhiteSpace(p.FirstName) || string.IsNullOrWhiteSpace(p.LastName) || string.IsNullOrWhiteSpace(p.Phone))
                    return Results.BadRequest(new ErrorResponse(
                        "Add your full name and phone number in Your details first — ASIC needs them to send the key."));

                RenewtronKeyRequestResult result;
                try
                {
                    result = await renewtron.RequestAsicKeyAsync(new RenewtronKeyRequestBody(
                        BusinessName: bn.Name,
                        Abn: await AbnForAsync(context, user, bn.Name, ct),
                        Email: user.Email ?? string.Empty,
                        GivenNames: p.FirstName.Trim(),
                        FamilyName: p.LastName.Trim(),
                        Phone: p.Phone.Trim(),
                        ExternalReference: bn.Id.ToString()), ct);
                }
                catch (RenewtronValidationException ex)
                {
                    return Results.BadRequest(new ErrorResponse(ex.Message));
                }

                var keyAvailable = result.Status == "KeyAvailable";
                bn.AsicKeyRequestId = result.Id;
                bn.AsicKeyRequestedAt = DateTimeOffset.UtcNow;
                bn.AsicKeyRequestStatus = keyAvailable ? "KeyReceived" : result.Status ?? "Pending";
                await context.SaveChangesAsync(ct);

                // Renewtron already had it: let the sync apply it under its ownership
                // rule — directly if they renewed this name through us, else via staff.
                if (keyAvailable)
                    await sync.SyncAsync(ct);

                return Results.Ok(new AsicKeyRequestResponse(bn.AsicKeyRequestStatus, bn.AsicKeyRequestedAt));
            })
            .RequireAuthorization()
            .WithTags("Business Names")
            .WithName("RequestAsicKey")
            .Produces<AsicKeyRequestResponse>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        // ASIC's letters for one of the customer's names — renewal confirmations, renewal
        // notices, key letters — kept by Renewtron from the inbox ASIC writes to. Each
        // letter prints the ASIC key, so they're only offered for a name whose key is on
        // file, and only the letters carrying that same key.
        app.MapGet("/api/business-names/{id:guid}/documents", async (
                Guid id, ClaimsPrincipal principal, UserManager<ApplicationUser> users,
                IApplicationDbContext context, RenewtronClient renewtron, CancellationToken ct) =>
            {
                var user = await users.GetUserAsync(principal);
                if (user is null) return Results.Unauthorized();

                var bn = await context.BusinessNames.AsNoTracking()
                    .FirstOrDefaultAsync(b => b.Id == id && b.UserId == user.Id, ct);
                if (bn is null) return Results.NotFound();
                if (string.IsNullOrWhiteSpace(bn.AsicKey) || !renewtron.IsConfigured)
                    return Results.Ok(Array.Empty<AsicDocumentResponse>());

                try
                {
                    var documents = await renewtron.GetAsicDocumentsAsync(bn.AsicKey, ct);
                    return Results.Ok(documents.Select(d => new AsicDocumentResponse(
                        d.Id, d.Kind ?? "Other", DocumentTitle(d.Kind), new DateTimeOffset(DateTime.SpecifyKind(d.ReceivedAt, DateTimeKind.Utc)))));
                }
                catch (HttpRequestException)
                {
                    return Results.Problem("Your ASIC letters aren't available right now.", statusCode: StatusCodes.Status503ServiceUnavailable);
                }
            })
            .RequireAuthorization()
            .WithTags("Business Names")
            .WithName("GetBusinessNameDocuments")
            .Produces<AsicDocumentResponse[]>();

        app.MapGet("/api/business-names/{id:guid}/documents/{documentId:guid}", async (
                Guid id, Guid documentId, ClaimsPrincipal principal, UserManager<ApplicationUser> users,
                IApplicationDbContext context, RenewtronClient renewtron, CancellationToken ct) =>
            {
                var user = await users.GetUserAsync(principal);
                if (user is null) return Results.Unauthorized();

                var bn = await context.BusinessNames.AsNoTracking()
                    .FirstOrDefaultAsync(b => b.Id == id && b.UserId == user.Id, ct);
                if (bn is null || string.IsNullOrWhiteSpace(bn.AsicKey) || !renewtron.IsConfigured)
                    return Results.NotFound();

                try
                {
                    // Renewtron checks the letter carries this key; anything else is a 404.
                    var documents = await renewtron.GetAsicDocumentsAsync(bn.AsicKey, ct);
                    var document = documents.FirstOrDefault(d => d.Id == documentId);
                    if (document is null) return Results.NotFound();

                    var pdf = await renewtron.GetAsicDocumentPdfAsync(documentId, bn.AsicKey, ct);
                    if (pdf is null) return Results.NotFound();

                    var fileName = $"{DocumentTitle(document.Kind)} - {SafeFileName(bn.Name)} - {document.ReceivedAt:yyyy-MM-dd}.pdf";
                    return Results.File(pdf, "application/pdf", fileName);
                }
                catch (HttpRequestException)
                {
                    return Results.Problem("This letter isn't available right now.", statusCode: StatusCodes.Status503ServiceUnavailable);
                }
            })
            .RequireAuthorization()
            .WithTags("Business Names")
            .WithName("DownloadBusinessNameDocument")
            .Produces(StatusCodes.Status200OK, contentType: "application/pdf");

        // Staff: apply a key Renewtron retrieved for a name the client requested but
        // didn't renew through us, once they've checked the client owns it.
        app.MapPost("/api/admin/clients/{clientId}/business-names/{id:guid}/apply-asic-key", async (
                string clientId, Guid id, IApplicationDbContext context, CancellationToken ct) =>
            {
                var bn = await context.BusinessNames.FirstOrDefaultAsync(b => b.Id == id && b.UserId == clientId, ct);
                if (bn is null) return Results.NotFound();
                if (string.IsNullOrEmpty(bn.PendingAsicKey))
                    return Results.BadRequest(new ErrorResponse("There's no key waiting for this business name."));

                bn.AsicKey = bn.PendingAsicKey;
                bn.PendingAsicKey = null;
                await context.SaveChangesAsync(ct);
                return Results.NoContent();
            })
            .RequireAuthorization("Admin")
            .WithTags("Admin")
            .WithName("ApplyPendingAsicKey")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        return app;
    }

    private static string DocumentTitle(string? kind) => kind switch
    {
        "RenewalConfirmation" => "Renewal confirmation",
        "RenewalNotice" => "Renewal notice",
        "KeyLetter" => "ASIC key letter",
        _ => "ASIC letter",
    };

    private static string SafeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var cleaned = new string(name.Trim().Select(c => invalid.Contains(c) ? ' ' : c).ToArray()).Trim();
        return cleaned.Length == 0 ? "Business name" : cleaned;
    }

    /// <summary>Best ABN for a name: the one Renewtron renewed it under, else the
    /// profile's, else the client's only ABN across their businesses and renewals.</summary>
    private static async Task<string?> AbnForAsync(
        IApplicationDbContext context, ApplicationUser user, string? businessName, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(businessName))
        {
            var lower = businessName.Trim().ToLower();
            var renewed = await context.BusinessNameRenewals.AsNoTracking()
                .Where(r => r.UserId == user.Id && r.Abn != "" && r.BusinessName.Trim().ToLower() == lower)
                .OrderByDescending(r => r.RenewedAt).Select(r => r.Abn).FirstOrDefaultAsync(ct);
            if (!string.IsNullOrEmpty(renewed)) return renewed;
        }
        if (!string.IsNullOrWhiteSpace(user.Profile.Abn)) return user.Profile.Abn.Trim();

        // Otherwise only when the client has exactly one ABN on file — guessing
        // between several would send ASIC the wrong one.
        var entityAbns = await context.BusinessEntities.AsNoTracking()
            .Where(e => e.UserId == user.Id && e.Abn != "").Select(e => e.Abn).ToListAsync(ct);
        var renewalAbns = await context.BusinessNameRenewals.AsNoTracking()
            .Where(r => r.UserId == user.Id && r.Abn != "").Select(r => r.Abn).ToListAsync(ct);
        var known = entityAbns.Concat(renewalAbns)
            .Select(a => new string(a.Where(char.IsDigit).ToArray()))
            .Where(a => a.Length == 11).Distinct().ToList();
        return known.Count == 1 ? known[0] : null;
    }
}
