using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Infrastructure.Ontraport;

/// <summary>Handles the Ontraport contact-sync and renewal-paid webhooks. Ported
/// from app/api/integrations/ontraport/* + lib/ontraport.ts.</summary>
public class OntraportService(
    UserManager<ApplicationUser> userManager,
    IApplicationDbContext context,
    IOptions<OntraportOptions> options,
    IConfiguration configuration,
    ILogger<OntraportService> logger) : IOntraportService
{
    private readonly OntraportOptions _options = options.Value;

    public bool VerifyWebhookSecret(string? provided) => VerifyAgainst(provided, _options.WebhookSecret);
    public bool VerifyRenewalSecret(string? provided) => VerifyAgainst(provided, _options.RenewalSecret);

    private static bool VerifyAgainst(string? provided, string? expected)
    {
        var want = expected?.Trim();
        if (string.IsNullOrEmpty(want) || string.IsNullOrEmpty(provided)) return false;
        var a = Encoding.UTF8.GetBytes(provided);
        var b = Encoding.UTF8.GetBytes(want);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }

    public async Task<OntraportResult> SyncContactAsync(IReadOnlyDictionary<string, string> payload, CancellationToken ct)
    {
        var mapped = OntraportMapper.MapPayload(payload);
        if (string.IsNullOrEmpty(mapped.Email))
            return new OntraportResult(400, new { ok = false, error = "email field required" });

        var existing = await userManager.FindByEmailAsync(mapped.Email);
        if (existing is not null)
        {
            // Refresh in place — password / other entities / messages / roles preserved.
            ApplyProfile(existing, mapped);
            await ApplyBusinessDataAsync(existing.Id, mapped, ct);
            await context.SaveChangesAsync(ct);
            return new OntraportResult(200, new { ok = true, action = "updated", userId = existing.Id });
        }

        // Create with a temporary password.
        var temp = GenerateTempPassword();
        var user = new ApplicationUser
        {
            UserName = mapped.Email,
            Email = mapped.Email,
            EmailConfirmed = true,
            CreatedAt = DateTimeOffset.UtcNow,
            Profile = new UserProfile
            {
                FirstName = mapped.Profile.FirstName,
                LastName = mapped.Profile.LastName,
                Phone = mapped.Profile.Phone,
                Dob = mapped.Profile.Dob,
                Tfn = mapped.Profile.Tfn,
                Address = mapped.Profile.Address,
                Suburb = mapped.Profile.Suburb,
                State = mapped.Profile.State,
                Postcode = mapped.Profile.Postcode,
            },
        };

        var result = await userManager.CreateAsync(user, temp);
        if (!result.Succeeded)
        {
            logger.LogWarning("Ontraport create failed for {Email}: {Errors}",
                mapped.Email, string.Join("; ", result.Errors.Select(e => e.Description)));
            return new OntraportResult(500, new { ok = false, error = "could not create user" });
        }

        context.Messages.Add(WelcomeMessage(user.Id));
        await ApplyBusinessDataAsync(user.Id, mapped, ct);
        await context.SaveChangesAsync(ct);

        // No mail adapter yet — log the temp password (console fallback, like the
        // original when RESEND_API_KEY is unset).
        var loginUrl = (configuration["PublicSiteUrl"] ?? "http://localhost:5173").TrimEnd('/') + "/login";
        logger.LogInformation("Ontraport created {Email}. Temp password: {Temp} — sign in at {LoginUrl}",
            mapped.Email, temp, loginUrl);

        return new OntraportResult(200, new { ok = true, action = "created", userId = user.Id });
    }

    public async Task<OntraportResult> ProcessRenewalPaidAsync(IReadOnlyDictionary<string, string> payload, CancellationToken ct)
    {
        string Pick(params string[] keys)
        {
            foreach (var k in keys)
                if (payload.TryGetValue(k, out var v) && !string.IsNullOrWhiteSpace(v))
                    return v.Trim();
            return string.Empty;
        }

        var email = Pick("email").ToLowerInvariant();
        var bnIdRaw = Pick("f5474", "bnId");
        var yearsOk = int.TryParse(Pick("f5475", "years"), out var years);
        var transactionId = Pick("transaction_id", "transactionId");

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(bnIdRaw) || !(yearsOk && (years == 1 || years == 3)))
            return new OntraportResult(400, new { ok = false, error = "missing or invalid email/bnId/years" });

        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
            return new OntraportResult(404, new { ok = false, error = "user not found" });

        if (!Guid.TryParse(bnIdRaw, out var bnId))
            return new OntraportResult(404, new { ok = false, error = "business name not found on this user" });

        var bn = await context.BusinessNames.FirstOrDefaultAsync(b => b.Id == bnId && b.UserId == user.Id, ct);
        if (bn is null)
            return new OntraportResult(404, new { ok = false, error = "business name not found on this user" });

        // Idempotency — a retried webhook with the same transaction_id is a no-op.
        if (!string.IsNullOrEmpty(transactionId) && bn.RenewalTransactionIds.Contains(transactionId))
            return new OntraportResult(200, new { ok = true, action = "already_processed", userId = user.Id, bnId = bnIdRaw, bnName = bn.Name });

        bn.RenewalDate = AddYears(bn.RenewalDate, years);
        if (!string.IsNullOrEmpty(transactionId))
            bn.RenewalTransactionIds = [.. bn.RenewalTransactionIds, transactionId]; // new list → EF detects the change

        var msg = new Message
        {
            UserId = user.Id,
            Direction = MessageDirection.Inbound,
            Subject = $"Business name renewal confirmed — {bn.Name}",
            Body = $"Your business name \"{bn.Name}\" has been renewed for {years} year{(years > 1 ? "s" : "")}. New renewal date: {bn.RenewalDate}.",
            Read = false,
            AdminRead = true,
        };
        msg.ThreadId = msg.Id;
        context.Messages.Add(msg);

        await context.SaveChangesAsync(ct);
        return new OntraportResult(200, new { ok = true, action = "renewed", userId = user.Id, bnId = bnIdRaw, bnName = bn.Name, renewalDate = bn.RenewalDate });
    }

    // ─────────────────────────────────────────────────────────────────────

    private static void ApplyProfile(ApplicationUser user, MappedContact mapped)
    {
        var p = user.Profile;
        var m = mapped.Profile;
        if (!string.IsNullOrEmpty(m.FirstName)) p.FirstName = m.FirstName;
        if (!string.IsNullOrEmpty(m.LastName)) p.LastName = m.LastName;
        if (!string.IsNullOrEmpty(m.Phone)) p.Phone = m.Phone;
        if (!string.IsNullOrEmpty(m.Dob)) p.Dob = m.Dob;
        if (!string.IsNullOrEmpty(m.Tfn)) p.Tfn = m.Tfn;
        if (!string.IsNullOrEmpty(m.Address)) p.Address = m.Address;
        if (!string.IsNullOrEmpty(m.Suburb)) p.Suburb = m.Suburb;
        if (!string.IsNullOrEmpty(m.State)) p.State = m.State;
        if (!string.IsNullOrEmpty(m.Postcode)) p.Postcode = m.Postcode;
    }

    /// <summary>Upsert the single entity (by ABN) and business name (by name) from
    /// the payload. Adds to the tracked context; the caller saves.</summary>
    private async Task ApplyBusinessDataAsync(string userId, MappedContact mapped, CancellationToken ct)
    {
        if (mapped.Entity is not null)
        {
            var abn = mapped.Entity.Abn;
            var existing = string.IsNullOrEmpty(abn)
                ? null
                : await context.BusinessEntities.FirstOrDefaultAsync(e => e.UserId == userId && e.Abn == abn, ct);

            if (existing is not null)
            {
                if (!string.IsNullOrEmpty(mapped.Entity.Name)) existing.Name = mapped.Entity.Name;
                if (mapped.Entity.EntityType != EntityType.Unspecified) existing.EntityType = mapped.Entity.EntityType;
                if (!string.IsNullOrEmpty(mapped.Entity.Acn)) existing.Acn = mapped.Entity.Acn;
                if (!string.IsNullOrEmpty(mapped.Entity.Industry)) existing.Industry = mapped.Entity.Industry;
            }
            else
            {
                context.BusinessEntities.Add(new BusinessEntity
                {
                    UserId = userId,
                    Name = mapped.Entity.Name,
                    EntityType = mapped.Entity.EntityType,
                    Abn = mapped.Entity.Abn,
                    Acn = mapped.Entity.Acn,
                    Industry = mapped.Entity.Industry,
                    Source = EntitySource.Manual,
                });
            }
        }

        if (mapped.BusinessName is not null)
        {
            var names = await context.BusinessNames.Where(b => b.UserId == userId).ToListAsync(ct);
            var key = mapped.BusinessName.Name.Trim();
            var existing = names.FirstOrDefault(b => string.Equals(b.Name.Trim(), key, StringComparison.OrdinalIgnoreCase));

            if (existing is not null)
            {
                if (!string.IsNullOrEmpty(mapped.BusinessName.RenewalDate))
                    existing.RenewalDate = mapped.BusinessName.RenewalDate;
            }
            else
            {
                context.BusinessNames.Add(new BusinessName
                {
                    UserId = userId,
                    Name = mapped.BusinessName.Name,
                    DateRegistered = string.Empty,
                    RenewalDate = mapped.BusinessName.RenewalDate,
                    AsicKey = string.Empty,
                });
            }
        }
    }

    private static Message WelcomeMessage(string userId)
    {
        var msg = new Message
        {
            UserId = userId,
            Direction = MessageDirection.Inbound,
            Subject = "Welcome to the Business Portal",
            Body = "Your Business Name is being Renewed and will be updated on its Renewal Date. Please send any support requests here.",
            Read = false,
            AdminRead = true,
        };
        msg.ThreadId = msg.Id;
        return msg;
    }

    private static string AddYears(string existing, int years)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var baseDate = today;
        if (DateOnly.TryParse(existing, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) && d > today)
            baseDate = d;
        return baseDate.AddYears(years).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static string GenerateTempPassword()
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(9))
            .Replace("+", "x").Replace("/", "y").Replace("=", string.Empty);
        return "Bp1!" + raw; // meets Identity's default policy (upper/lower/digit/special)
    }
}
