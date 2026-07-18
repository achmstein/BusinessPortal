using BusinessPortal.Application.BusinessNames.Commands.CreateBusinessName;
using BusinessPortal.Application.BusinessNames.Commands.DeleteBusinessName;
using BusinessPortal.Application.BusinessNames.Commands.UpdateBusinessName;
using BusinessPortal.Application.BusinessNames.Queries.GetBusinessNames;
using MediatR;

namespace BusinessPortal.Web.Endpoints;

public static class BusinessNamesEndpoints
{
    public static IEndpointRouteBuilder MapBusinessNamesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/business-names")
            .WithTags("Business Names")
            .RequireAuthorization();

        group.MapGet("/", async (ISender sender) =>
                Results.Ok(await sender.Send(new GetBusinessNamesQuery())))
            .WithName("GetBusinessNames")
            .Produces<IReadOnlyList<BusinessNameDto>>();

        group.MapPost("/", async (CreateBusinessNameCommand command, ISender sender) =>
                Results.Ok(new IdResponse(await sender.Send(command))))
            .WithName("CreateBusinessName")
            .Produces<IdResponse>();

        group.MapPut("/{id:guid}", async (Guid id, UpdateBusinessNameCommand command, ISender sender) =>
            {
                await sender.Send(command with { Id = id });
                return Results.NoContent();
            })
            .WithName("UpdateBusinessName")
            .Produces(StatusCodes.Status204NoContent);

        group.MapDelete("/{id:guid}", async (Guid id, ISender sender) =>
            {
                await sender.Send(new DeleteBusinessNameCommand(id));
                return Results.NoContent();
            })
            .WithName("DeleteBusinessName")
            .Produces(StatusCodes.Status204NoContent);

        return app;
    }
}
