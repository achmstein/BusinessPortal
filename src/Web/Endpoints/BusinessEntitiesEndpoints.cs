using BusinessPortal.Application.BusinessEntities.Commands.CreateBusinessEntity;
using BusinessPortal.Application.BusinessEntities.Commands.DeleteBusinessEntity;
using BusinessPortal.Application.BusinessEntities.Queries.GetBusinessEntities;
using MediatR;

namespace BusinessPortal.Web.Endpoints;

/// <summary>The client's multi-entity portfolio. CQRS over minimal API — each
/// handler just sends a MediatR command/query (Asictron convention).</summary>
public static class BusinessEntitiesEndpoints
{
    public static IEndpointRouteBuilder MapBusinessEntitiesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/business-entities")
            .WithTags("Business Entities")
            .RequireAuthorization();

        group.MapGet("/", async (ISender sender) =>
                Results.Ok(await sender.Send(new GetBusinessEntitiesQuery())))
            .WithName("GetBusinessEntities")
            .Produces<IReadOnlyList<BusinessEntityDto>>();

        group.MapPost("/", async (CreateBusinessEntityCommand command, ISender sender) =>
                Results.Ok(new IdResponse(await sender.Send(command))))
            .WithName("CreateBusinessEntity")
            .Produces<IdResponse>();

        group.MapDelete("/{id:guid}", async (Guid id, ISender sender) =>
            {
                await sender.Send(new DeleteBusinessEntityCommand(id));
                return Results.NoContent();
            })
            .WithName("DeleteBusinessEntity")
            .Produces(StatusCodes.Status204NoContent);

        return app;
    }
}
