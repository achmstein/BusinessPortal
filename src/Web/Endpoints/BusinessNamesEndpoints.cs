using BusinessPortal.Application.BusinessNames.Commands.CancelBusinessName;
using BusinessPortal.Application.BusinessNames.Commands.CreateBusinessName;
using BusinessPortal.Application.BusinessNames.Commands.DeleteBusinessName;
using BusinessPortal.Application.BusinessNames.Commands.UpdateBusinessName;
using BusinessPortal.Application.BusinessNames.Queries.GetBusinessNames;
using MediatR;

namespace BusinessPortal.Web.Endpoints;

public static class BusinessNamesEndpoints
{
    public record CancelBody(string? Scope, string? CardName, string? CardNumber, string? Expiry, string? Ccv);

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

        // Cancellation flow (demo payment). Mirrors processCancellation: presence-check
        // the card fields (nothing is charged or stored), then remove the name and post
        // the confirmation/support messages.
        group.MapPost("/{id:guid}/cancel", async (Guid id, CancelBody body, ISender sender) =>
            {
                var cardNumber = (body.CardNumber ?? string.Empty).Replace(" ", "");
                if (string.IsNullOrWhiteSpace(body.CardName) || cardNumber.Length < 12 ||
                    string.IsNullOrWhiteSpace(body.Expiry) || (body.Ccv ?? string.Empty).Trim().Length < 3)
                    return Results.BadRequest(new ErrorResponse("Please complete all card fields"));

                await sender.Send(new CancelBusinessNameCommand(id, body.Scope == "name_and_abn"));
                return Results.NoContent();
            })
            .WithName("CancelBusinessName")
            .Produces(StatusCodes.Status204NoContent)
            .Produces<ErrorResponse>(StatusCodes.Status400BadRequest);

        return app;
    }
}
