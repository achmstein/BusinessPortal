using BusinessPortal.Application.AbnLookup.Commands.RequestAbnLookup;
using BusinessPortal.Application.AbnLookup.Queries.GetAbnLookupStatus;
using MediatR;

namespace BusinessPortal.Web.Endpoints;

public static class AbnLookupEndpoints
{
    public static IEndpointRouteBuilder MapAbnLookupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/abn-lookup")
            .WithTags("ABN Lookup")
            .RequireAuthorization();

        // Kick off a background lookup for the current user's businesses.
        group.MapPost("/", async (ISender sender) =>
                Results.Ok(new JobStartedResponse(await sender.Send(new RequestAbnLookupCommand()))))
            .WithName("StartAbnLookup")
            .Produces<JobStartedResponse>();

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
