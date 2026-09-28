using BusinessPortal.Application.BusinessNames.Commands.CancelBusinessName;
using BusinessPortal.Application.BusinessNames.Commands.CreateBusinessName;
using BusinessPortal.Application.BusinessNames.Commands.DeleteBusinessName;
using BusinessPortal.Application.BusinessNames.Commands.UpdateBusinessName;
using BusinessPortal.Application.BusinessNames.Queries.GetBusinessNames;
using MediatR;

namespace BusinessPortal.Web.Endpoints;

public static class BusinessNamesEndpoints
{
    public record CancelBody(string? Scope);

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

        // Cancellation removes the name and, when the ABN is included, raises an
        // ABN support ticket.
        //
        // This used to accept a cardholder name, full card number, expiry and CCV,
        // validate their shape, and then discard them — CancelBusinessNameCommand
        // takes only the id and the ABN flag, and no processor was ever called.
        // Nothing was charged, so accepting card details put raw PANs and CCVs into
        // request bodies (and any request logging) for no purpose at all, while
        // dragging the whole application into PCI scope. If a cancellation fee is
        // wanted, take it the way renewals do — through the hosted payment form,
        // which keeps card data off this server entirely.
        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelBody body, ISender sender) =>
            {
                await sender.Send(new CancelBusinessNameCommand(id, body.Scope == "name_and_abn"));
                return Results.NoContent();
            })
            .WithName("CancelBusinessName")
            .Produces(StatusCodes.Status204NoContent);

        return app;
    }
}
