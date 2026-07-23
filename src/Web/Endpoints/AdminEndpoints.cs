using System.Security.Claims;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Application.Messages.Queries.GetMessageThreads;
using BusinessPortal.Domain.Entities;
using BusinessPortal.Domain.Enums;
using BusinessPortal.Domain.Services;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Web.Endpoints;

/// <summary>Admin console APIs — overview, clients, shared inbox, and impersonation.
/// Gated by the Admin role (except stop-impersonation, which the impersonated
/// non-admin session must be able to call).</summary>
public static class AdminEndpoints
{
    public record ImpersonateBody(string? Reason);
    public record AdminReplyBody(Guid? ThreadId, string? Subject, string Body);

    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin").WithTags("Admin").RequireAuthorization("Admin");

        group.MapGet("/overview", async (UserManager<ApplicationUser> users, IApplicationDbContext context, CancellationToken ct) =>
        {
            var clients = await users.Users.CountAsync(ct);
            var msgs = await context.Messages.AsNoTracking().ToListAsync(ct);
            var activeThreads = msgs.Select(m => m.ThreadId ?? m.Id).Distinct().Count();
            var unread = msgs.Count(m => m.Direction == MessageDirection.Outbound && !m.AdminRead);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var names = await context.BusinessNames.AsNoTracking().ToListAsync(ct);
            var renewalsDue = names.Count(b =>
            {
                var d = AsicRenewalEvaluator.DaysUntil(b.RenewalDate, today);
                return d.HasValue && d.Value <= 30;
            });
            return Results.Ok(new AdminOverviewResponse(clients, activeThreads, unread, renewalsDue));
        }).WithName("GetAdminOverview").Produces<AdminOverviewResponse>();

        group.MapGet("/clients", async (UserManager<ApplicationUser> users, CancellationToken ct) =>
        {
            var clients = await users.Users
                .OrderBy(u => u.Email)
                .Select(u => new
                {
                    id = u.Id, email = u.Email,
                    firstName = u.Profile.FirstName, lastName = u.Profile.LastName,
                    atoConnected = u.AtoConnected, createdAt = u.CreatedAt,
                })
                .ToListAsync(ct);
            return Results.Ok(clients);
        }).WithName("GetAdminClients");

        group.MapGet("/clients/{id}", async (string id, UserManager<ApplicationUser> users, IApplicationDbContext context, CancellationToken ct) =>
        {
            var user = await users.FindByIdAsync(id);
            if (user is null) return Results.NotFound();

            var entityRows = await context.BusinessEntities.AsNoTracking()
                .Where(e => e.UserId == id).OrderByDescending(e => e.Created).ToListAsync(ct);
            var entities = entityRows.Select(e => new { e.Id, e.Name, EntityType = e.EntityType.ToString(), e.Abn, e.Acn, e.Industry });

            var names = await context.BusinessNames.AsNoTracking()
                .Where(b => b.UserId == id).OrderBy(b => b.Name)
                .Select(b => new { b.Id, b.Name, b.RenewalDate, b.AsicKey }).ToListAsync(ct);

            var p = user.Profile;
            return Results.Ok(new
            {
                id = user.Id, email = user.Email, atoConnected = user.AtoConnected,
                profile = new { p.FirstName, p.LastName, p.Phone, p.Dob, p.Tfn, p.Address, p.Suburb, p.State, p.Postcode },
                entities, businessNames = names,
            });
        }).WithName("GetAdminClient");

        // Shared inbox — every client's threads, grouped.
        group.MapGet("/messages", async (UserManager<ApplicationUser> users, IApplicationDbContext context, CancellationToken ct) =>
        {
            var all = await context.Messages.AsNoTracking().ToListAsync(ct);
            var clientMap = (await users.Users
                    .Select(u => new { u.Id, u.Email, u.Profile.FirstName, u.Profile.LastName })
                    .ToListAsync(ct))
                .ToDictionary(c => c.Id);

            var result = all.GroupBy(m => m.UserId).Select(g =>
            {
                clientMap.TryGetValue(g.Key, out var c);
                var name = c is null ? "" : $"{c.FirstName} {c.LastName}".Trim();
                return new
                {
                    clientId = g.Key,
                    email = c?.Email,
                    name = string.IsNullOrEmpty(name) ? c?.Email : name,
                    threads = ThreadDto.GroupIntoThreads(g),
                };
            }).ToList();

            return Results.Ok(result);
        }).WithName("GetAdminMessages");

        // One client's conversations — powers the /admin/messages/{clientId} thread page.
        group.MapGet("/messages/{clientId}", async (string clientId, UserManager<ApplicationUser> users, IApplicationDbContext context, CancellationToken ct) =>
        {
            var user = await users.FindByIdAsync(clientId);
            if (user is null) return Results.NotFound();

            var msgs = await context.Messages.AsNoTracking()
                .Where(m => m.UserId == clientId).ToListAsync(ct);
            var name = $"{user.Profile.FirstName} {user.Profile.LastName}".Trim();
            return Results.Ok(new AdminClientThreadsResponse(
                user.Id, user.Email, string.IsNullOrEmpty(name) ? user.Email : name,
                ThreadDto.GroupIntoThreads(msgs)));
        }).WithName("GetAdminClientThreads").Produces<AdminClientThreadsResponse>();

        // Mark every client-sent message for this client as read by support.
        group.MapPost("/messages/{clientId}/read-all", async (string clientId, IApplicationDbContext context, CancellationToken ct) =>
        {
            var unread = await context.Messages
                .Where(m => m.UserId == clientId && m.Direction == MessageDirection.Outbound && !m.AdminRead)
                .ToListAsync(ct);
            foreach (var m in unread) m.AdminRead = true;
            await context.SaveChangesAsync(ct);
            return Results.NoContent();
        }).WithName("AdminMarkAllRead").Produces(StatusCodes.Status204NoContent);

        // Cross-client registry — every business name, entity, and company/trust.
        group.MapGet("/registry", async (UserManager<ApplicationUser> users, IApplicationDbContext context, CancellationToken ct) =>
        {
            // Registry is about clients — exclude admin accounts, like the original.
            var adminIds = (await users.GetUsersInRoleAsync(Roles.Admin)).Select(u => u.Id).ToList();
            var clients = await users.Users
                .Where(u => !adminIds.Contains(u.Id))
                .Select(u => new { u.Id, u.Email, u.Profile.FirstName, u.Profile.LastName })
                .ToListAsync(ct);
            var refs = clients.ToDictionary(
                c => c.Id,
                c =>
                {
                    var name = $"{c.FirstName} {c.LastName}".Trim();
                    return new RegistryClientRef(c.Id, string.IsNullOrEmpty(name) ? c.Email ?? "" : name, c.Email);
                });
            var clientIds = clients.Select(c => c.Id).ToList();

            var names = await context.BusinessNames.AsNoTracking()
                .Where(b => clientIds.Contains(b.UserId)).ToListAsync(ct);
            var entities = await context.BusinessEntities.AsNoTracking()
                .Where(e => clientIds.Contains(e.UserId)).ToListAsync(ct);

            var nameRows = names
                .Select(b => new RegistryBusinessNameRow(b.Id, b.Name, b.AsicKey, b.DateRegistered, b.RenewalDate, refs[b.UserId]))
                .ToList();
            var entityRows = entities
                .Select(e => new RegistryEntityRow(
                    e.Id, e.Name,
                    e.EntityType == EntityType.Unspecified ? "" : e.EntityType.ToString(),
                    e.Abn, e.Acn, e.Industry, refs[e.UserId]))
                .ToList();
            // The original also folded in the legacy "primary business" — that concept
            // wasn't ported (entities are the single source), so companies come from
            // entities alone and Source is always "Entity".
            var companyRows = entities
                .Where(e => e.EntityType is EntityType.Company or EntityType.Trust)
                .Select(e => new RegistryCompanyRow(e.Name, e.Acn, e.Abn, "Entity", refs[e.UserId]))
                .ToList();

            return Results.Ok(new AdminRegistryResponse(clients.Count, nameRows, entityRows, companyRows));
        }).WithName("GetAdminRegistry").Produces<AdminRegistryResponse>();

        // Admin sends a message to a client (support -> client = inbound for the client).
        group.MapPost("/clients/{id}/reply", async (string id, AdminReplyBody body, IApplicationDbContext context, CancellationToken ct) =>
        {
            var message = new Message
            {
                UserId = id,
                Direction = MessageDirection.Inbound,
                Subject = body.Subject ?? string.Empty,
                Body = body.Body,
                Read = false,     // the client hasn't read it
                AdminRead = true, // admin wrote it
            };
            message.ThreadId = body.ThreadId is { } t && t != Guid.Empty ? t : message.Id;
            context.Messages.Add(message);
            await context.SaveChangesAsync(ct);
            return Results.Ok(new IdResponse(message.Id));
        }).WithName("AdminReplyToClient").Produces<IdResponse>();

        // Start impersonating a client.
        group.MapPost("/clients/{id}/impersonate", async (
            string id, ImpersonateBody body, ClaimsPrincipal principal,
            UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn,
            IApplicationDbContext context, HttpContext http, CancellationToken ct) =>
        {
            if (principal.HasClaim(c => c.Type == ImpersonationClaims.Impersonating))
                return Results.BadRequest(new { error = "Already impersonating — exit first." });

            var adminId = principal.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var target = await users.FindByIdAsync(id);
            if (target is null) return Results.NotFound();
            if (target.Id == adminId) return Results.BadRequest(new { error = "You can't impersonate yourself." });
            if (await users.IsInRoleAsync(target, Roles.Admin)) return Results.BadRequest(new { error = "You can't impersonate an admin." });

            var log = new ImpersonationLog
            {
                AdminUserId = adminId,
                TargetUserId = target.Id,
                StartedAt = DateTimeOffset.UtcNow,
                Reason = body.Reason,
                IpAddress = http.Connection.RemoteIpAddress?.ToString(),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
            };
            context.ImpersonationLogs.Add(log);
            await context.SaveChangesAsync(ct);

            await signIn.SignInWithClaimsAsync(target, isPersistent: false, new[]
            {
                new Claim(ImpersonationClaims.Impersonating, "true"),
                new Claim(ImpersonationClaims.OriginalAdminId, adminId),
                new Claim(ImpersonationClaims.LogId, log.Id.ToString()),
            });

            return Results.Ok(new { ok = true, targetId = target.Id });
        }).WithName("StartImpersonation");

        // Stop impersonating — callable by the impersonated (non-admin) session.
        app.MapPost("/api/stop-impersonation", async (
            ClaimsPrincipal principal, UserManager<ApplicationUser> users,
            SignInManager<ApplicationUser> signIn, IApplicationDbContext context, CancellationToken ct) =>
        {
            var adminId = principal.FindFirstValue(ImpersonationClaims.OriginalAdminId);
            if (adminId is null) return Results.BadRequest(new { error = "Not impersonating." });

            if (Guid.TryParse(principal.FindFirstValue(ImpersonationClaims.LogId), out var logId))
            {
                var log = await context.ImpersonationLogs.FirstOrDefaultAsync(l => l.Id == logId, ct);
                if (log is not null && log.EndedAt is null)
                {
                    log.EndedAt = DateTimeOffset.UtcNow;
                    await context.SaveChangesAsync(ct);
                }
            }

            var admin = await users.FindByIdAsync(adminId);
            if (admin is null) { await signIn.SignOutAsync(); return Results.Ok(new { ok = true }); }

            await signIn.SignInAsync(admin, isPersistent: false); // back to admin (roles re-added)
            return Results.Ok(new { ok = true });
        }).WithName("StopImpersonation").RequireAuthorization();

        return app;
    }
}
