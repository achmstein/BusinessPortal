using BusinessPortal.Application.Messages.Commands.DeleteThread;
using BusinessPortal.Application.Messages.Commands.MarkThreadRead;
using BusinessPortal.Application.Messages.Commands.ReplyToThread;
using BusinessPortal.Application.Messages.Commands.StartThread;
using BusinessPortal.Application.Messages.Queries.GetMessageThreads;
using MediatR;

namespace BusinessPortal.Web.Endpoints;

public static class MessagesEndpoints
{
    public record ReplyBody(string Body);

    public static IEndpointRouteBuilder MapMessagesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/messages")
            .WithTags("Messages")
            .RequireAuthorization();

        group.MapGet("/threads", async (ISender sender) =>
                Results.Ok(await sender.Send(new GetMessageThreadsQuery())))
            .WithName("GetMessageThreads")
            .Produces<IReadOnlyList<ThreadDto>>();

        group.MapPost("/threads", async (StartThreadCommand command, ISender sender) =>
                Results.Ok(new ThreadStartedResponse(await sender.Send(command))))
            .WithName("StartThread")
            .Produces<ThreadStartedResponse>();

        group.MapPost("/threads/{threadId:guid}/replies", async (Guid threadId, ReplyBody body, ISender sender) =>
            {
                await sender.Send(new ReplyToThreadCommand(threadId, body.Body));
                return Results.NoContent();
            })
            .WithName("ReplyToThread")
            .Produces(StatusCodes.Status204NoContent);

        group.MapPost("/threads/{threadId:guid}/read", async (Guid threadId, ISender sender) =>
            {
                await sender.Send(new MarkThreadReadCommand(threadId));
                return Results.NoContent();
            })
            .WithName("MarkThreadRead")
            .Produces(StatusCodes.Status204NoContent);

        group.MapDelete("/threads/{threadId:guid}", async (Guid threadId, ISender sender) =>
            {
                await sender.Send(new DeleteThreadCommand(threadId));
                return Results.NoContent();
            })
            .WithName("DeleteThread")
            .Produces(StatusCodes.Status204NoContent);

        return app;
    }
}
