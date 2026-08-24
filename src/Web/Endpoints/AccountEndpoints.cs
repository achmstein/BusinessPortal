using System.Security.Claims;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Entities;
using BusinessPortal.Domain.Enums;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace BusinessPortal.Web.Endpoints;

/// <summary>Account/session endpoints that talk to Identity directly.
/// Login/refresh come from MapIdentityApi; this adds registration (with profile
/// + welcome-message seeding, like the original registerAction), "who am I", and logout.</summary>
public static class AccountEndpoints
{
    public record RegisterBody(string Email, string Password, string FirstName, string LastName);

    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Account");

        // Custom register (MapIdentityApi's /api/register can't seed the profile or
        // sign the cookie in). Mirrors the original: validate, create with first/last
        // name, seed the welcome message, start the session.
        group.MapPost("/account/register", async (
                RegisterBody body,
                UserManager<ApplicationUser> users,
                SignInManager<ApplicationUser> signIn,
                IApplicationDbContext context,
                CancellationToken ct) =>
            {
                var email = body.Email.Trim().ToLowerInvariant();
                // Matches Identity's configured RequiredLength and what the
                // register screen tells people — all three move together.
                if (string.IsNullOrEmpty(email) || body.Password.Length < 8)
                    return Results.BadRequest(new ErrorResponse("Enter an email address and a password of at least 8 characters."));
                if (await users.FindByEmailAsync(email) is not null)
                    return Results.BadRequest(new ErrorResponse("An account with that email already exists"));

                var user = new ApplicationUser
                {
                    UserName = email,
                    Email = email,
                    // No email-confirmation concept in the original portal — and Identity's
                    // forgot/reset-password endpoints no-op for unconfirmed accounts.
                    EmailConfirmed = true,
                    CreatedAt = DateTimeOffset.UtcNow,
                    Profile = new UserProfile
                    {
                        FirstName = body.FirstName.Trim(),
                        LastName = body.LastName.Trim(),
                    },
                };
                var created = await users.CreateAsync(user, body.Password);
                if (!created.Succeeded)
                    return Results.BadRequest(new ErrorResponse(
                        string.Join(" ", created.Errors.Select(e => e.Description))));

                // seedMessages() port — the single welcome thread every new account gets.
                var welcome = new Message
                {
                    UserId = user.Id,
                    Direction = MessageDirection.Inbound,
                    Subject = "Welcome to your Business Portal",
                    Body = "Your Business Name is being Renewed and will be updated on its " +
                           "Renewal Date. Please send any support requests here.",
                    Read = false,
                    AdminRead = true,
                };
                welcome.ThreadId = welcome.Id;
                context.Messages.Add(welcome);
                await context.SaveChangesAsync(ct);

                await signIn.SignInAsync(user, isPersistent: false);
                return Results.Ok();
            })
            .RequireRateLimiting("register")
            .WithName("RegisterAccount")
            .Produces(StatusCodes.Status200OK)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        group.MapGet("/me", async (ClaimsPrincipal principal, UserManager<ApplicationUser> userManager) =>
            {
                var user = await userManager.GetUserAsync(principal);
                if (user is null)
                    return Results.Unauthorized();

                return Results.Ok(new MeResponse(
                    user.Id,
                    user.Email,
                    principal.IsInRole(Roles.Admin),
                    user.AtoConnected,
                    user.Profile.FirstName,
                    user.Profile.LastName,
                    principal.HasClaim(c => c.Type == ImpersonationClaims.Impersonating)));
            })
            .RequireAuthorization()
            .WithName("GetMe")
            .Produces<MeResponse>()
            .Produces(StatusCodes.Status401Unauthorized);

        group.MapPost("/logout", async (SignInManager<ApplicationUser> signInManager) =>
            {
                await signInManager.SignOutAsync();
                return Results.Ok();
            })
            .RequireAuthorization()
            .WithName("Logout");

        return app;
    }
}
