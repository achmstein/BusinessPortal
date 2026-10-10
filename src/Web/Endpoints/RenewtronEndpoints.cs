using System.Security.Claims;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Entities;
using BusinessPortal.Domain.Enums;
using BusinessPortal.Infrastructure.Identity;
using BusinessPortal.Infrastructure.Renewtron;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Web.Endpoints;

public record CheckoutResponse(string Url);
public record AsicKeyRequestResponse(string Status, DateTimeOffset? RequestedAt);

/// <summary>The customer-facing side of the Renewtron integration: renewing through
/// Renewtron's checkout (Stripe, which starts the ASIC renewal immediately), and
/// asking Renewtron to retrieve an ASIC key.</summary>
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

        // Ask our team to get the ASIC key. Raised as a staff-only message in the
        // admin inbox — it never appears in the client's own Messages section.
        app.MapPost("/api/business-names/{id:guid}/request-asic-key", async (
                Guid id, ClaimsPrincipal principal, UserManager<ApplicationUser> users,
                IApplicationDbContext context, CancellationToken ct) =>
            {
                var user = await users.GetUserAsync(principal);
                if (user is null) return Results.Unauthorized();

                var bn = await context.BusinessNames.FirstOrDefaultAsync(b => b.Id == id && b.UserId == user.Id, ct);
                if (bn is null) return Results.NotFound();
                if (!string.IsNullOrEmpty(bn.AsicKey))
                    return Results.BadRequest(new ErrorResponse("This business name already has an ASIC key."));

                var p = user.Profile;
                var clientName = $"{p.FirstName} {p.LastName}".Trim();
                var abn = await AbnForAsync(context, user, bn.Name, ct);
                var details = string.Join("\n", new[]
                {
                    $"Business name: {bn.Name}",
                    string.IsNullOrWhiteSpace(abn) ? null : $"ABN: {abn}",
                    string.IsNullOrWhiteSpace(clientName) ? null : $"Client: {clientName}",
                    $"Email: {user.Email}",
                    string.IsNullOrWhiteSpace(p.Phone) ? null : $"Phone: {p.Phone.Trim()}",
                }.Where(line => line is not null));

                var request = new Message
                {
                    UserId = user.Id,
                    Direction = MessageDirection.Outbound, // client -> support
                    Subject = $"ASIC key request — {bn.Name}",
                    Body = $"The client has asked for the ASIC key for this business name.\n\n{details}",
                    Read = true,
                    AdminRead = false,
                    StaffOnly = true,
                };
                request.ThreadId = request.Id;
                context.Messages.Add(request);

                // Clear any earlier Renewtron request so its sync doesn't overwrite this.
                bn.AsicKeyRequestId = null;
                bn.AsicKeyRequestedAt = DateTimeOffset.UtcNow;
                bn.AsicKeyRequestStatus = "Manual";
                await context.SaveChangesAsync(ct);

                return Results.Ok(new AsicKeyRequestResponse(bn.AsicKeyRequestStatus, bn.AsicKeyRequestedAt));
            })
            .RequireAuthorization()
            .WithTags("Business Names")
            .WithName("RequestAsicKey")
            .Produces<AsicKeyRequestResponse>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

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
