using System.Security.Claims;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace BusinessPortal.Web.Endpoints;

/// <summary>Account/session endpoints that talk to Identity directly.
/// Login/register/refresh come from MapIdentityApi; this adds "who am I" + logout.</summary>
public static class AccountEndpoints
{
    public static IEndpointRouteBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Account");

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
                    user.Profile.LastName));
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
