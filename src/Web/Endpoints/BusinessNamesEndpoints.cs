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
            Results.Ok(await sender.Send(new GetBusinessNamesQuery())));

        group.MapPost("/", async (CreateBusinessNameCommand command, ISender sender) =>
        {
            var id = await sender.Send(command);
            return Results.Ok(new { id });
        });

        group.MapPut("/{id:guid}", async (Guid id, UpdateBusinessNameCommand command, ISender sender) =>
        {
            await sender.Send(command with { Id = id });
            return Results.NoContent();
        });

        group.MapDelete("/{id:guid}", async (Guid id, ISender sender) =>
        {
            await sender.Send(new DeleteBusinessNameCommand(id));
            return Results.NoContent();
        });

        return app;
    }
}
