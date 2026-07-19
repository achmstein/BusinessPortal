using System.Text.Json;
using BusinessPortal.Application.Common.Interfaces;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Infrastructure.Ato;

/// <summary>A decrypted in-progress link attempt.</summary>
public record LoadedAttempt(AuthFlowState State, string ReferenceCode);

/// <summary>DB-backed storage for the encrypted <see cref="AuthFlowState"/> that lives
/// between BeginAuth and WaitForApproval — C# port of lib/ato/attempt-store.ts. The
/// original kept this in the DB (not a cookie) because Server-Action cookies don't survive
/// Next.js redirects; here the SPA holds the attempt id and passes it back to the poll
/// endpoint, which is equally robust. Encrypted via Data Protection so a DB leak can't
/// replay a half-finished login. Short-lived (poll timeout + 60s), governed by ExpiresAt.</summary>
public sealed class AtoAttemptStore(IApplicationDbContext db, IDataProtectionProvider provider)
{
    private readonly IApplicationDbContext _db = db;
    private readonly IDataProtector _protector = provider.CreateProtector("BusinessPortal.Ato.AttemptStore.v1");

    /// <summary>Save state and return the attempt id the SPA carries to the poll endpoint.</summary>
    public async Task<Guid> SaveAsync(string userId, AuthFlowState state, string referenceCode,
        TimeSpan? ttl = null, CancellationToken ct = default)
    {
        var lifetime = ttl ?? TimeSpan.FromMilliseconds(AtoConstants.GetPollTimeoutMs() + 60_000);
        var row = new AtoLinkAttempt
        {
            UserId = userId,
            StateEncrypted = _protector.Protect(JsonSerializer.Serialize(state)),
            ReferenceCode = referenceCode,
            ExpiresAt = DateTimeOffset.UtcNow.Add(lifetime),
            CreatedAt = DateTimeOffset.UtcNow,
        };
        _db.AtoLinkAttempts.Add(row);
        await _db.SaveChangesAsync(ct);
        return row.Id;
    }

    /// <summary>Look up an attempt by id and decrypt its state. Null if missing/expired/
    /// belongs to another user.</summary>
    public async Task<LoadedAttempt?> LoadAsync(Guid attemptId, string userId, CancellationToken ct = default)
    {
        var row = await _db.AtoLinkAttempts.FirstOrDefaultAsync(a => a.Id == attemptId, ct);
        if (row is null) return null;
        if (row.UserId != userId) return null; // someone else's attempt — pretend it's gone
        if (row.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            await DropAsync(row, ct);
            return null;
        }
        try
        {
            var state = JsonSerializer.Deserialize<AuthFlowState>(_protector.Unprotect(row.StateEncrypted))!;
            return new LoadedAttempt(state, row.ReferenceCode);
        }
        catch
        {
            await DropAsync(row, ct);
            return null;
        }
    }

    /// <summary>Delete a single attempt (after success/failure, to keep the table tidy).</summary>
    public Task DeleteAsync(Guid attemptId, CancellationToken ct = default) =>
        _db.AtoLinkAttempts.Where(a => a.Id == attemptId).ExecuteDeleteAsync(ct);

    /// <summary>Cheap GC of expired attempts for a user. Run opportunistically.</summary>
    public Task PurgeExpiredAsync(string userId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        return _db.AtoLinkAttempts.Where(a => a.UserId == userId && a.ExpiresAt < now).ExecuteDeleteAsync(ct);
    }

    private async Task DropAsync(AtoLinkAttempt row, CancellationToken ct)
    {
        _db.AtoLinkAttempts.Remove(row);
        try { await _db.SaveChangesAsync(ct); } catch { /* best-effort GC */ }
    }
}
