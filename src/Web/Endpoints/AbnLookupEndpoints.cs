using BusinessPortal.Application.AbnLookup.Commands.RequestAbnLookup;
using BusinessPortal.Application.AbnLookup.Queries.GetAbnLookupStatus;
using System.Security.Claims;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Services;
using BusinessPortal.Infrastructure.Identity;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Web.Endpoints;

public static class AbnLookupEndpoints
{
    public static IEndpointRouteBuilder MapAbnLookupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/abn-lookup")
            .WithTags("ABN Lookup")
            .RequireAuthorization();

        // Kick off a background lookup for the current user's ABNs (profile + businesses).
        // With none on file there is nothing to search, and "no new names" would read
        // as "you have no business names" — so say what's actually missing.
        group.MapPost("/", async (ISender sender, ClaimsPrincipal principal, UserManager<ApplicationUser> users,
                IApplicationDbContext context) =>
            {
                var user = await users.GetUserAsync(principal);
                if (user is null) return Results.Unauthorized();

                var abns = await context.BusinessEntities
                    .Where(e => e.UserId == user.Id)
                    .Select(e => e.Abn)
                    .ToListAsync();
                if (!abns.Append(user.Profile.Abn).Any(AbnUtil.IsValidAbn))
                    return Results.BadRequest(new ErrorResponse("Add your ABN first, so we know what to look up."));

                return Results.Ok(new JobStartedResponse(await sender.Send(new RequestAbnLookupCommand())));
            })
            .WithName("StartAbnLookup")
            .Produces<JobStartedResponse>()
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        // Poll job progress/status.
        group.MapGet("/status", async (ISender sender) =>
            {
                var status = await sender.Send(new GetAbnLookupStatusQuery());
                return status is null ? Results.NoContent() : Results.Ok(status);
            })
            .WithName("GetAbnLookupStatus")
            .Produces<AbnLookupJobDto>()
            .Produces(StatusCodes.Status204NoContent);

        return app;
    }
}
