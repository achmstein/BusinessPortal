using System.Text.Json;
using BusinessPortal.Application.Common.Interfaces;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Infrastructure.Ato;

/// <summary>A decrypted ATO session loaded from storage.</summary>
public record LoadedAtoSession(string Email, string CookiesJson, IReadOnlyList<AtoAgent> Agents, DateTimeOffset ExpiresAt);

/// <summary>Encrypted persistence for ATO session cookie jars — C# port of
/// lib/ato/cookie-store.ts. The original hand-rolled AES-256-GCM with an HKDF-from-
/// SESSION_SECRET key; here we use ASP.NET Data Protection (already configured to persist
/// keys to the mounted volume), which manages key material + rotation for us. The blobs
/// are opaque and only ever read back by this store, so byte-compatibility with the
/// original scheme is unnecessary. Encrypting-at-rest matters because the jar holds
/// session-bearer cookies for ato.gov.au — a DB leak must not be replayable.</summary>
public sealed class AtoCookieStore(IApplicationDbContext db, IDataProtectionProvider provider)
{
    /// <summary>Conservative session-cookie expiry guess (matches the original 12h).</summary>
    public static readonly TimeSpan DefaultSessionTtl = TimeSpan.FromHours(12);

    private readonly IApplicationDbContext _db = db;
    private readonly IDataProtector _protector = provider.CreateProtector("BusinessPortal.Ato.CookieStore.v1");

    /// <summary>Upsert an encrypted ATO session for (userId, email).</summary>
    public async Task SaveAsync(string userId, string email, string cookiesJson,
        IReadOnlyList<AtoAgent> agents, TimeSpan? ttl = null, CancellationToken ct = default)
    {
        var normEmail = email.ToLowerInvariant();
        var now = DateTimeOffset.UtcNow;
        var row = await _db.AtoSessions.FirstOrDefaultAsync(s => s.UserId == userId && s.Email == normEmail, ct);
        if (row is null)
        {
            row = new AtoSession { UserId = userId, Email = normEmail, CreatedAt = now };
            _db.AtoSessions.Add(row);
        }
        row.CookiesEncrypted = _protector.Protect(cookiesJson);
        row.AgentsJson = JsonSerializer.Serialize(agents);
        row.ExpiresAt = now.Add(ttl ?? DefaultSessionTtl);
        row.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);
    }

    /// <summary>Load the most recent un-expired ATO session for a user (null if none).</summary>
    public async Task<LoadedAtoSession?> LoadForUserAsync(string userId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var row = await _db.AtoSessions
            .Where(s => s.UserId == userId && s.ExpiresAt > now)
            .OrderByDescending(s => s.UpdatedAt)
            .FirstOrDefaultAsync(ct);
        return await MaterializeAsync(row, ct);
    }

    /// <summary>Load by (userId, email) — when the caller knows which myID account is current.</summary>
    public async Task<LoadedAtoSession?> LoadAsync(string userId, string email, CancellationToken ct = default)
    {
        var normEmail = email.ToLowerInvariant();
        var row = await _db.AtoSessions.FirstOrDefaultAsync(s => s.UserId == userId && s.Email == normEmail, ct);
        if (row is null || row.ExpiresAt <= DateTimeOffset.UtcNow) return null;
        return await MaterializeAsync(row, ct);
    }

    /// <summary>Delete the current user's ATO session(s).</summary>
    public Task DeleteForUserAsync(string userId, CancellationToken ct = default) =>
        _db.AtoSessions.Where(s => s.UserId == userId).ExecuteDeleteAsync(ct);

    private async Task<LoadedAtoSession?> MaterializeAsync(AtoSession? row, CancellationToken ct)
    {
        if (row is null) return null;
        try
        {
            var cookiesJson = _protector.Unprotect(row.CookiesEncrypted);
            var agents = JsonSerializer.Deserialize<List<AtoAgent>>(
                string.IsNullOrEmpty(row.AgentsJson) ? "[]" : row.AgentsJson) ?? [];
            return new LoadedAtoSession(row.Email, cookiesJson, agents, row.ExpiresAt);
        }
        catch
        {
            // Decrypt failed — likely the data-protection key rotated. Drop the row so
            // Path A (cookie reuse) doesn't keep re-hitting a session it can't read.
            _db.AtoSessions.Remove(row);
            try { await _db.SaveChangesAsync(ct); } catch { /* best-effort GC */ }
            return null;
        }
    }
}
