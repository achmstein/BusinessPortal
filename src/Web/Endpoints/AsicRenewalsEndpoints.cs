using BusinessPortal.Application.AsicRenewals.Commands.RenewBusinessName;
using BusinessPortal.Application.AsicRenewals.Queries.GetAsicRenewals;
using MediatR;

namespace BusinessPortal.Web.Endpoints;

public static class AsicRenewalsEndpoints
{
    public record RenewBody(int Years);

    public static IEndpointRouteBuilder MapAsicRenewalsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/asic-renewals")
            .WithTags("ASIC Renewals")
            .RequireAuthorization();

        group.MapGet("/", async (ISender sender) =>
            Results.Ok(await sender.Send(new GetAsicRenewalsQuery())));

        group.MapPost("/{id:guid}/renew", async (Guid id, RenewBody body, ISender sender) =>
        {
            var renewalDate = await sender.Send(new RenewBusinessNameCommand(id, body.Years));
            return Results.Ok(new { renewalDate });
        });

        return app;
    }
}
