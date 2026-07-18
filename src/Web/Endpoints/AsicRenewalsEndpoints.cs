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
                Results.Ok(await sender.Send(new GetAsicRenewalsQuery())))
            .WithName("GetAsicRenewals")
            .Produces<IReadOnlyList<AsicRenewalDto>>();

        group.MapPost("/{id:guid}/renew", async (Guid id, RenewBody body, ISender sender) =>
                Results.Ok(new RenewalResponse(await sender.Send(new RenewBusinessNameCommand(id, body.Years)))))
            .WithName("RenewBusinessName")
            .Produces<RenewalResponse>();

        return app;
    }
}
