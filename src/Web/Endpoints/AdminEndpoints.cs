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
            // Email health: a dead provider key shows up here within one send.
            var since = DateTimeOffset.UtcNow.AddHours(-24);
            var failures = await context.EmailLogs.AsNoTracking()
                .Where(e => e.At >= since && e.Status != ResendEmailSender.Statuses.Sent)
                .OrderByDescending(e => e.At).ToListAsync(ct);
            var lastError = failures.FirstOrDefault()?.Error
                ?? (failures.Count > 0 ? "No email provider key is set." : null);
            var welcomePending = (await WelcomePendingAsync(context, ct)).Count;

            return Results.Ok(new AdminOverviewResponse(
                clients, activeThreads, unread, renewalsDue, failures.Count, lastError, welcomePending));
        }).WithName("GetAdminOverview").Produces<AdminOverviewResponse>();

        // Searched and paged on the server. The console previously fetched every
        // client and filtered in the browser, which is fine at a hundred clients
        // and not at ten thousand. Returns a named shape so the generated client
        // is typed — the page used to hand-declare its own interface and cast.
        group.MapGet("/clients", async (
            UserManager<ApplicationUser> users,
            string? q,
            int page,
            int pageSize,
            CancellationToken ct) =>
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize == 0 ? 25 : pageSize, 1, 200);

            var query = users.Users.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(u =>
                    (u.Email != null && EF.Functions.ILike(u.Email, $"%{term}%")) ||
                    EF.Functions.ILike(u.Profile.FirstName, $"%{term}%") ||
                    EF.Functions.ILike(u.Profile.LastName, $"%{term}%"));
            }

            var total = await query.CountAsync(ct);
            var items = await query
                .OrderBy(u => u.Profile.LastName).ThenBy(u => u.Email)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(u => new AdminClientRow(
                    u.Id, u.Email, u.Profile.FirstName, u.Profile.LastName, u.AtoConnected, u.CreatedAt))
                .ToListAsync(ct);

            return Results.Ok(new AdminClientsPage(total, page, pageSize, items));
        }).WithName("GetAdminClients").Produces<AdminClientsPage>();

        group.MapGet("/clients/{id}", async (string id, UserManager<ApplicationUser> users, IApplicationDbContext context, CancellationToken ct) =>
        {
            var user = await users.FindByIdAsync(id);
            if (user is null) return Results.NotFound();

            var entityRows = await context.BusinessEntities.AsNoTracking()
                .Where(e => e.UserId == id).OrderByDescending(e => e.Created).ToListAsync(ct);
            var entities = entityRows.Select(e => new { e.Id, e.Name, EntityType = e.EntityType.ToString(), e.Abn, e.Acn, e.Industry });

            var names = await context.BusinessNames.AsNoTracking()
                .Where(b => b.UserId == id).OrderBy(b => b.Name)
                .Select(b => new { b.Id, b.Name, b.RenewalDate, b.AsicKey, b.PendingAsicKey, b.AsicKeyRequestStatus }).ToListAsync(ct);

            var emails = await context.EmailLogs.AsNoTracking()
                .Where(e => e.UserId == id).OrderByDescending(e => e.At).Take(10)
                .Select(e => new EmailLogRow(e.Kind, e.Status, e.Error, e.At)).ToListAsync(ct);

            var p = user.Profile;
            return Results.Ok(new
            {
                emails,
                id = user.Id, email = user.Email, atoConnected = user.AtoConnected,
                profile = new { p.FirstName, p.LastName, p.Phone, p.Dob, p.Tfn, p.Abn, p.Address, p.Suburb, p.State, p.Postcode },
                entities, businessNames = names,
            });
        }).WithName("GetAdminClient");

        // Re-send one client's welcome email (fresh set-password + sign-in links).
        group.MapPost("/clients/{id}/resend-welcome", async (
                string id, UserManager<ApplicationUser> users, UserProvisioningService provisioning) =>
            {
                var user = await users.FindByIdAsync(id);
                if (user is null) return Results.NotFound();
                if (await users.IsInRoleAsync(user, Roles.Admin))
                    return Results.BadRequest(new ErrorResponse("Staff accounts don't get welcome emails."));
                return Results.Ok(new ResendWelcomeResponse(await provisioning.SendWelcomeAsync(user)));
            })
            .WithName("ResendWelcomeEmail")
            .Produces<ResendWelcomeResponse>();

        // Re-send to every auto-created account whose welcome never went out. Stops at
        // the first failure: with a dead provider key every send fails the same way,
        // and there's no point burning through the list.
        group.MapPost("/clients/resend-welcome-pending", async (
                UserManager<ApplicationUser> users, UserProvisioningService provisioning,
                IApplicationDbContext context, CancellationToken ct) =>
            {
                var pending = await WelcomePendingAsync(context, ct);
                int attempted = 0, sent = 0;
                foreach (var userId in pending)
                {
                    var user = await users.FindByIdAsync(userId);
                    if (user is null) continue;
                    attempted++;
                    var status = await provisioning.SendWelcomeAsync(user);
                    if (status != ResendEmailSender.Statuses.Sent)
                        return Results.Ok(new ResendPendingResponse(attempted, sent,
                            status == ResendEmailSender.Statuses.NotConfigured
                                ? "No email provider key is set."
                                : "The email provider rejected the send — check the key in Integrations."));
                    sent++;
                }
                return Results.Ok(new ResendPendingResponse(attempted, sent, null));
            })
            .WithName("ResendPendingWelcomeEmails")
            .Produces<ResendPendingResponse>();

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

        // ── Cross-client registry ──
        //
        // This used to be a single unparameterised call returning every business
        // name, entity and company across every client in one payload, which the
        // browser then filtered in render with no memoisation and no paging. It
        // degraded directly with customer count. Each tab is now its own searched,
        // paged query, and the tab counts come from three COUNTs rather than from
        // materialising every row in order to length it.
        //
        // Admin accounts are excluded throughout: the registry is about clients.

        static async Task<List<string>> ClientIdsAsync(UserManager<ApplicationUser> users, CancellationToken ct)
        {
            var adminIds = (await users.GetUsersInRoleAsync(Roles.Admin)).Select(u => u.Id).ToHashSet();
            return await users.Users.Where(u => !adminIds.Contains(u.Id)).Select(u => u.Id).ToListAsync(ct);
        }

        static async Task<Dictionary<string, RegistryClientRef>> ClientRefsAsync(
            UserManager<ApplicationUser> users, IEnumerable<string> ids, CancellationToken ct)
        {
            var set = ids.ToHashSet();
            var rows = await users.Users
                .Where(u => set.Contains(u.Id))
                .Select(u => new { u.Id, u.Email, u.Profile.FirstName, u.Profile.LastName })
                .ToListAsync(ct);
            return rows.ToDictionary(c => c.Id, c =>
            {
                var name = $"{c.FirstName} {c.LastName}".Trim();
                return new RegistryClientRef(c.Id, string.IsNullOrEmpty(name) ? c.Email ?? "" : name, c.Email);
            });
        }

        static (int Page, int Size) Paging(int page, int pageSize) =>
            (Math.Max(1, page), Math.Clamp(pageSize == 0 ? 25 : pageSize, 1, 200));

        group.MapGet("/registry/summary", async (
            UserManager<ApplicationUser> users, IApplicationDbContext context, CancellationToken ct) =>
        {
            var clientIds = await ClientIdsAsync(users, ct);
            var names = await context.BusinessNames.CountAsync(b => clientIds.Contains(b.UserId), ct);
            var entities = await context.BusinessEntities.CountAsync(e => clientIds.Contains(e.UserId), ct);
            var companies = await context.BusinessEntities.CountAsync(
                e => clientIds.Contains(e.UserId) &&
                     (e.EntityType == EntityType.Company || e.EntityType == EntityType.Trust), ct);
            return Results.Ok(new RegistrySummaryResponse(clientIds.Count, names, entities, companies));
        }).WithName("GetRegistrySummary").Produces<RegistrySummaryResponse>();

        group.MapGet("/registry/business-names", async (
            UserManager<ApplicationUser> users, IApplicationDbContext context,
            string? q, int page, int pageSize, CancellationToken ct) =>
        {
            var (p, size) = Paging(page, pageSize);
            var clientIds = await ClientIdsAsync(users, ct);

            var query = context.BusinessNames.AsNoTracking().Where(b => clientIds.Contains(b.UserId));
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(b =>
                    EF.Functions.ILike(b.Name, $"%{term}%") || EF.Functions.ILike(b.AsicKey, $"%{term}%"));
            }

            var total = await query.CountAsync(ct);
            var rows = await query.OrderBy(b => b.Name).Skip((p - 1) * size).Take(size).ToListAsync(ct);
            var refs = await ClientRefsAsync(users, rows.Select(r => r.UserId), ct);

            var items = rows
                .Select(b => new RegistryBusinessNameRow(
                    b.Id, b.Name, b.AsicKey, b.DateRegistered, b.RenewalDate,
                    refs.GetValueOrDefault(b.UserId, new RegistryClientRef(b.UserId, "Unknown", null))))
                .ToList();

            return Results.Ok(new RegistryBusinessNamesPage(total, p, size, items));
        }).WithName("GetRegistryBusinessNames").Produces<RegistryBusinessNamesPage>();

        group.MapGet("/registry/entities", async (
            UserManager<ApplicationUser> users, IApplicationDbContext context,
            string? q, int page, int pageSize, CancellationToken ct) =>
        {
            var (p, size) = Paging(page, pageSize);
            var clientIds = await ClientIdsAsync(users, ct);

            var query = context.BusinessEntities.AsNoTracking().Where(e => clientIds.Contains(e.UserId));
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(e =>
                    EF.Functions.ILike(e.Name, $"%{term}%") ||
                    EF.Functions.ILike(e.Abn, $"%{term}%") ||
                    EF.Functions.ILike(e.Acn, $"%{term}%") ||
                    EF.Functions.ILike(e.Industry, $"%{term}%"));
            }

            var total = await query.CountAsync(ct);
            var rows = await query.OrderBy(e => e.Name).Skip((p - 1) * size).Take(size).ToListAsync(ct);
            var refs = await ClientRefsAsync(users, rows.Select(r => r.UserId), ct);

            var items = rows
                .Select(e => new RegistryEntityRow(
                    e.Id, e.Name,
                    e.EntityType == EntityType.Unspecified ? "" : e.EntityType.ToString(),
                    e.Abn, e.Acn, e.Industry,
                    refs.GetValueOrDefault(e.UserId, new RegistryClientRef(e.UserId, "Unknown", null))))
                .ToList();

            return Results.Ok(new RegistryEntitiesPage(total, p, size, items));
        }).WithName("GetRegistryEntities").Produces<RegistryEntitiesPage>();

        group.MapGet("/registry/companies", async (
            UserManager<ApplicationUser> users, IApplicationDbContext context,
            string? q, int page, int pageSize, CancellationToken ct) =>
        {
            var (p, size) = Paging(page, pageSize);
            var clientIds = await ClientIdsAsync(users, ct);

            var query = context.BusinessEntities.AsNoTracking()
                .Where(e => clientIds.Contains(e.UserId) &&
                            (e.EntityType == EntityType.Company || e.EntityType == EntityType.Trust));
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(e =>
                    EF.Functions.ILike(e.Name, $"%{term}%") ||
                    EF.Functions.ILike(e.Abn, $"%{term}%") ||
                    EF.Functions.ILike(e.Acn, $"%{term}%"));
            }

            var total = await query.CountAsync(ct);
            var rows = await query.OrderBy(e => e.Name).Skip((p - 1) * size).Take(size).ToListAsync(ct);
            var refs = await ClientRefsAsync(users, rows.Select(r => r.UserId), ct);

            var items = rows
                .Select(e => new RegistryCompanyRow(
                    e.Name, e.Acn, e.Abn, "Entity",
                    refs.GetValueOrDefault(e.UserId, new RegistryClientRef(e.UserId, "Unknown", null))))
                .ToList();

            return Results.Ok(new RegistryCompaniesPage(total, p, size, items));
        }).WithName("GetRegistryCompanies").Produces<RegistryCompaniesPage>();

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

    /// <summary>Accounts the Renewtron sync created (so they never chose to sign up)
    /// that have no welcome email on record as sent.</summary>
    private static async Task<List<string>> WelcomePendingAsync(IApplicationDbContext context, CancellationToken ct)
    {
        var created = await context.RenewtronProvisionLogs.AsNoTracking()
            .Where(l => l.Outcome == ProvisionOutcome.Created && l.UserId != null)
            .Select(l => l.UserId!).Distinct().ToListAsync(ct);
        var welcomed = await context.EmailLogs.AsNoTracking()
            .Where(e => e.Kind == ResendEmailSender.Kinds.Welcome && e.Status == ResendEmailSender.Statuses.Sent && e.UserId != null)
            .Select(e => e.UserId!).Distinct().ToListAsync(ct);
        return created.Except(welcomed).ToList();
    }
}
