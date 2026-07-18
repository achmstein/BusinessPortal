using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Web.Endpoints;

/// <summary>Admin console read APIs — clients list + detail. Gated by the Admin
/// role policy. Talks to UserManager + the DbContext directly.</summary>
public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin")
            .WithTags("Admin")
            .RequireAuthorization("Admin");

        group.MapGet("/clients", async (UserManager<ApplicationUser> users) =>
        {
            var clients = await users.Users
                .OrderBy(u => u.Email)
                .Select(u => new
                {
                    id = u.Id,
                    email = u.Email,
                    firstName = u.Profile.FirstName,
                    lastName = u.Profile.LastName,
                    atoConnected = u.AtoConnected,
                    createdAt = u.CreatedAt,
                })
                .ToListAsync();

            return Results.Ok(clients);
        });

        group.MapGet("/clients/{id}", async (string id, UserManager<ApplicationUser> users, IApplicationDbContext context) =>
        {
            var user = await users.FindByIdAsync(id);
            if (user is null) return Results.NotFound();

            var entityRows = await context.BusinessEntities.AsNoTracking()
                .Where(e => e.UserId == id)
                .OrderByDescending(e => e.Created)
                .ToListAsync();

            var entities = entityRows.Select(e => new
            {
                e.Id, e.Name, EntityType = e.EntityType.ToString(), e.Abn, e.Acn, e.Industry,
            });

            var names = await context.BusinessNames.AsNoTracking()
                .Where(b => b.UserId == id)
                .OrderBy(b => b.Name)
                .Select(b => new { b.Id, b.Name, b.RenewalDate, b.AsicKey })
                .ToListAsync();

            var p = user.Profile;
            return Results.Ok(new
            {
                id = user.Id,
                email = user.Email,
                atoConnected = user.AtoConnected,
                profile = new { p.FirstName, p.LastName, p.Phone, p.Dob, p.Tfn, p.Address, p.Suburb, p.State, p.Postcode },
                entities,
                businessNames = names,
            });
        });

        return app;
    }
}
