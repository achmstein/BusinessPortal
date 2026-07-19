using BusinessPortal.Application.Common.Interfaces;

namespace BusinessPortal.Web.Endpoints;

/// <summary>The real ATO myID integration: link (OAuth chain, polled), pick an ABN
/// (auto-syncs businesses + nominates us), sync on demand, unlink. Thin handlers over
/// <see cref="IAtoService"/>. UNVERIFIED end-to-end — needs a live myID account.</summary>
public static class AtoEndpoints
{
    public record StartLinkRequest(string Email);
    public record PollLinkRequest(Guid AttemptId);
    public record SelectAgentRequest(string Abn);

    public static IEndpointRouteBuilder MapAtoEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ato").WithTags("ATO").RequireAuthorization();

        group.MapGet("/status", async (IUser user, IAtoService svc, CancellationToken ct) =>
                Results.Ok(await svc.GetStatusAsync(user.Id!, ct)))
            .WithName("GetAtoStatus")
            .Produces<AtoStatusResult>();

        group.MapPost("/link/start", async (StartLinkRequest body, IUser user, IAtoService svc, CancellationToken ct) =>
            {
                if (string.IsNullOrWhiteSpace(body.Email))
                    return Results.BadRequest(new { error = "email is required" });
                return Results.Ok(await svc.StartLinkAsync(user.Id!, body.Email.Trim(), ct));
            })
            .WithName("StartAtoLink")
            .Produces<AtoLinkStartResult>();

        // Long-poll: returns within ~20s with Pending (poll again), or Linked/Failed/Expired.
        group.MapPost("/link/poll", async (PollLinkRequest body, IUser user, IAtoService svc, CancellationToken ct) =>
                Results.Ok(await svc.PollLinkAsync(user.Id!, body.AttemptId, ct)))
            .WithName("PollAtoLink")
            .Produces<AtoPollResult>();

        group.MapPost("/link/select", async (SelectAgentRequest body, IUser user, IAtoService svc, CancellationToken ct) =>
            {
                if (string.IsNullOrWhiteSpace(body.Abn))
                    return Results.BadRequest(new { error = "abn is required" });
                return Results.Ok(await svc.SelectAgentAsync(user.Id!, body.Abn.Trim(), ct));
            })
            .WithName("SelectAtoAgent")
            .Produces<AtoSelectResult>();

        group.MapPost("/sync", async (IUser user, IAtoService svc, CancellationToken ct) =>
                Results.Ok(await svc.SyncBusinessesAsync(user.Id!, ct)))
            .WithName("SyncAtoBusinesses")
            .Produces<AtoSyncResult>();

        group.MapPost("/unlink", async (IUser user, IAtoService svc, CancellationToken ct) =>
            {
                await svc.UnlinkAsync(user.Id!, ct);
                return Results.NoContent();
            })
            .WithName("UnlinkAto")
            .Produces(StatusCodes.Status204NoContent);

        return app;
    }
}
