using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using BusinessPortal.Application.Common.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.Identity;

/// <summary>Profile fields to seed/refresh on the user. Empty strings are
/// "unknown" and never overwrite an existing value.</summary>
public sealed record ProvisionProfile(
    string FirstName = "", string LastName = "", string Phone = "", string Dob = "",
    string Tfn = "", string Address = "", string Suburb = "", string State = "", string Postcode = "");

public sealed record ProvisionUserResult(ApplicationUser? User, bool Created, string? Error);

/// <summary>Find-or-create a portal login for a customer, shared by the Ontraport
/// contact-sync webhook and the Renewtron completed-renewal sync. New accounts get
/// a random password, EmailConfirmed = true (Identity's forgot/reset flow no-ops
/// for unconfirmed accounts, and these addresses were already used to pay), a
/// welcome message, and a set-your-password invite email. The caller saves —
/// except the user row itself, which UserManager persists immediately.</summary>
public class UserProvisioningService(
    UserManager<ApplicationUser> userManager,
    IApplicationDbContext context,
    ResendEmailSender emailSender,
    ILogger<UserProvisioningService> logger)
{
    public async Task<ProvisionUserResult> EnsureUserAsync(string email, ProvisionProfile profile, CancellationToken ct)
    {
        var existing = await userManager.FindByEmailAsync(email);
        if (existing is not null)
        {
            // Refresh in place — password / other entities / messages / roles preserved.
            ApplyProfile(existing, profile);
            return new ProvisionUserResult(existing, Created: false, null);
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            CreatedAt = DateTimeOffset.UtcNow,
            Profile = new UserProfile
            {
                FirstName = profile.FirstName,
                LastName = profile.LastName,
                Phone = profile.Phone,
                Dob = profile.Dob,
                Tfn = profile.Tfn,
                Address = profile.Address,
                Suburb = profile.Suburb,
                State = profile.State,
                Postcode = profile.Postcode,
            },
        };

        var result = await userManager.CreateAsync(user, GenerateTempPassword());
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            logger.LogWarning("Provisioning create failed for {Email}: {Errors}", email, errors);
            return new ProvisionUserResult(null, Created: false, errors);
        }

        context.Messages.Add(WelcomeMessage(user.Id));
        await SendInviteAsync(user, email);
        return new ProvisionUserResult(user, Created: true, null);
    }

    /// <summary>Email a set-your-password link. The code is a standard Identity
    /// password-reset token, base64url-encoded exactly like MapIdentityApi's
    /// /forgotPassword produces, so the existing /reset-password SPA page and
    /// /api/resetPassword endpoint accept it unchanged. Send failures are logged
    /// inside the sender, never thrown — an email outage must not fail
    /// provisioning (the customer can always use Forgot password).</summary>
    private async Task SendInviteAsync(ApplicationUser user, string email)
    {
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var code = Base64Url.EncodeToString(Encoding.UTF8.GetBytes(token));
        await emailSender.SendInviteAsync(user, email, code);
    }

    private static void ApplyProfile(ApplicationUser user, ProvisionProfile incoming)
    {
        var p = user.Profile;
        if (!string.IsNullOrEmpty(incoming.FirstName)) p.FirstName = incoming.FirstName;
        if (!string.IsNullOrEmpty(incoming.LastName)) p.LastName = incoming.LastName;
        if (!string.IsNullOrEmpty(incoming.Phone)) p.Phone = incoming.Phone;
        if (!string.IsNullOrEmpty(incoming.Dob)) p.Dob = incoming.Dob;
        if (!string.IsNullOrEmpty(incoming.Tfn)) p.Tfn = incoming.Tfn;
        if (!string.IsNullOrEmpty(incoming.Address)) p.Address = incoming.Address;
        if (!string.IsNullOrEmpty(incoming.Suburb)) p.Suburb = incoming.Suburb;
        if (!string.IsNullOrEmpty(incoming.State)) p.State = incoming.State;
        if (!string.IsNullOrEmpty(incoming.Postcode)) p.Postcode = incoming.Postcode;
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

    private static string GenerateTempPassword()
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(9))
            .Replace("+", "x").Replace("/", "y").Replace("=", string.Empty);
        return "Bp1!" + raw; // meets Identity's default policy (upper/lower/digit/special)
    }
}
