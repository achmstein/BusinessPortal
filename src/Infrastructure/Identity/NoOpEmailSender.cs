using Microsoft.AspNetCore.Identity;

namespace BusinessPortal.Infrastructure.Identity;

/// <summary>Swallows Identity's confirmation/reset emails. The app sends its own
/// mail via the (to-be-ported) email adapter; this just satisfies the dependency
/// that <c>MapIdentityApi</c> requires. Mirrors Asictron.</summary>
public sealed class NoOpEmailSender : IEmailSender<ApplicationUser>
{
    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
        => Task.CompletedTask;

    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
        => Task.CompletedTask;

    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
        => Task.CompletedTask;
}
