using System.Security.Claims;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace BusinessPortal.Web.Endpoints;

/// <summary>Personal details — the owned UserProfile on the current user.
/// Uses UserManager directly (user-centric, like Asictron's UsersEndpoints).</summary>
public static class ProfileEndpoints
{
    public record ProfileModel(
        string? FirstName, string? LastName, string? Phone, string? Dob, string? Tfn, string? Abn,
        string? Address, string? Suburb, string? State, string? Postcode);

    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profile").WithTags("Profile").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
            {
                var user = await users.GetUserAsync(principal);
                if (user is null) return Results.Unauthorized();
                var p = user.Profile;
                return Results.Ok(new ProfileModel(
                    p.FirstName, p.LastName, p.Phone, p.Dob, p.Tfn, p.Abn, p.Address, p.Suburb, p.State, p.Postcode));
            })
            .WithName("GetProfile")
            .Produces<ProfileModel>()
            .Produces(StatusCodes.Status401Unauthorized);

        group.MapPut("/", async (ProfileModel model, ClaimsPrincipal principal, UserManager<ApplicationUser> users) =>
            {
                var user = await users.GetUserAsync(principal);
                if (user is null) return Results.Unauthorized();

                var p = user.Profile;
                p.FirstName = model.FirstName ?? string.Empty;
                p.LastName = model.LastName ?? string.Empty;
                p.Phone = model.Phone ?? string.Empty;
                p.Dob = model.Dob ?? string.Empty;
                p.Tfn = model.Tfn ?? string.Empty;
                p.Abn = model.Abn ?? string.Empty;
                p.Address = model.Address ?? string.Empty;
                p.Suburb = model.Suburb ?? string.Empty;
                p.State = model.State ?? string.Empty;
                p.Postcode = model.Postcode ?? string.Empty;

                await users.UpdateAsync(user);
                return Results.NoContent();
            })
            .WithName("UpdateProfile")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status401Unauthorized);

        return app;
    }
}
