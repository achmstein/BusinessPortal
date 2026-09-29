using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Infrastructure.Identity;

/// <summary>Email settings. Ported from the original lib/email.ts adapter:
/// with no API key configured, emails are logged to the console instead of sent.
/// Either provider works — Resend wins when both keys are set; SendGrid exists so
/// the portal can reuse Renewtron's already-verified SendGrid sender.</summary>
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string From { get; set; } = "Business Portal <no-reply@localhost>";
    public string? ResendApiKey { get; set; }
    public string? SendGridApiKey { get; set; }

    /// <summary>Public base URL used in emailed links (the original NEXT_PUBLIC_SITE_URL).</summary>
    public string SiteUrl { get; set; } = "http://localhost:5173";
}

/// <summary>Identity email sender backed by Resend (https://resend.com), ported from
/// the original lib/email.ts + forgot-password email copy. Send failures are logged,
/// not thrown — the forgot-password flow must not leak whether an email exists.
/// IOptionsMonitor (this is a singleton) so settings saved from the admin UI apply
/// without a restart.</summary>
public sealed class ResendEmailSender(
    IHttpClientFactory httpClientFactory,
    IOptionsMonitor<EmailOptions> options,
    ILogger<ResendEmailSender> logger) : IEmailSender<ApplicationUser>
{
    public const string HttpClientName = "resend";

    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink) =>
        SendAsync(email,
            "Confirm your Business Portal email",
            $"<p>Hi {EscapeHtml(NameOf(user))},</p><p>Confirm your email by clicking the link below.</p><p><a href=\"{confirmationLink}\">{confirmationLink}</a></p>",
            $"Hi {NameOf(user)},\n\nConfirm your Business Portal email: {confirmationLink}");

    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink) =>
        SendAsync(email,
            "Reset your Business Portal password",
            ResetHtml(NameOf(user), resetLink),
            ResetText(NameOf(user), resetLink));

    // MapIdentityApi's /forgotPassword sends a reset *code*; wrap it in the same
    // one-click link the original app emailed (reset page reads email+code params).
    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
    {
        var link = ResetLink(email, resetCode);
        return SendAsync(email, "Reset your Business Portal password",
            ResetHtml(NameOf(user), link), ResetText(NameOf(user), link));
    }

    /// <summary>Set-your-password invite for auto-provisioned accounts (Renewtron
    /// sales and renewals). The code is a standard password-reset token, so the
    /// invite reuses the existing /reset-password page. <paramref name="signInUrl"/>
    /// is a one-click sign-in link, when that feature is configured — it opens the
    /// portal straight away; the password is for coming back later.</summary>
    public Task SendInviteAsync(ApplicationUser user, string email, string resetCode, string? signInUrl = null)
    {
        // welcome=1 tells the reset page this person is choosing a first
        // password, not replacing a forgotten one — the copy differs.
        var link = ResetLink(email, resetCode) + "&welcome=1";
        var name = NameOf(user);

        var openHtml = signInUrl is null ? "" :
            $"<p><a href=\"{EscapeHtml(signInUrl)}\">Open your Business Portal</a> — this link signs you in " +
            "straight away. It works once, for 72 hours.</p>" +
            "<p>To sign in again later, set a password:</p>";
        var openText = signInUrl is null ? "" :
            $"Open your Business Portal (signs you in; works once, for 72 hours): {signInUrl}\n\n" +
            "To sign in again later, set a password.\n";

        return SendAsync(email,
            "Your Business Portal account is ready",
            $"<p>Hi {EscapeHtml(name)},</p>" +
            "<p>A Business Portal account has been created for you as part of your business name renewal. " +
            "You can see your business names and renewal dates, and message our support team, any time.</p>" +
            openHtml +
            $"<p>Click the link below to set your password and sign in. The link expires in {TokenTtl}.</p>" +
            $"<p><a href=\"{link}\">{link}</a></p>" +
            $"<p>If the link has expired, use “Forgot password” at {EscapeHtml(LoginUrl)} — it emails you a fresh one.</p>",
            $"Hi {name},\n\n" +
            "A Business Portal account has been created for you as part of your business name renewal.\n\n" +
            openText +
            $"Set your password and sign in: {link}\n\n" +
            $"The link expires in {TokenTtl}. If it has expired, use “Forgot password” at {LoginUrl} to get a fresh one.");
    }

    /// <summary>Matches DataProtectionTokenProviderOptions.TokenLifespan in
    /// DependencyInjection — update both together.</summary>
    private const string TokenTtl = "48 hours";

    private string LoginUrl => $"{options.CurrentValue.SiteUrl.TrimEnd('/')}/login";

    private string ResetLink(string email, string resetCode) =>
        $"{options.CurrentValue.SiteUrl.TrimEnd('/')}/reset-password" +
        $"?email={Uri.EscapeDataString(email)}&code={Uri.EscapeDataString(resetCode)}";

    private string NameOf(ApplicationUser user) =>
        string.IsNullOrWhiteSpace(user.Profile.FirstName) ? user.Email ?? "" : user.Profile.FirstName;

    // Copy ported from the original requestReset server action (TTL updated to
    // match the configured token lifespan).
    private static string ResetHtml(string name, string link) =>
        $"<p>Hi {EscapeHtml(name)},</p>" +
        "<p>Someone (hopefully you) asked to reset the password on your Business Portal account.</p>" +
        $"<p>Click the link below to choose a new one. The link expires in {TokenTtl}.</p>" +
        $"<p><a href=\"{link}\">{link}</a></p>" +
        "<p>If you didn't request this, you can safely ignore this email.</p>";

    private static string ResetText(string name, string link) =>
        $"Hi {name},\n\nReset your Business Portal password: {link}\n\n" +
        $"Link expires in {TokenTtl}. If you didn't request this, ignore this email.";

    private async Task SendAsync(string to, string subject, string html, string text)
    {
        var email = options.CurrentValue;
        try
        {
            if (!string.IsNullOrWhiteSpace(email.ResendApiKey))
            {
                await SendViaResendAsync(email, to, subject, html, text);
            }
            else if (!string.IsNullOrWhiteSpace(email.SendGridApiKey))
            {
                await SendViaSendGridAsync(email, to, subject, html, text);
            }
            else
            {
                logger.LogInformation(
                    "📧 [EMAIL — console adapter; set Email:ResendApiKey or Email:SendGridApiKey to send for real]\n" +
                    "To:      {To}\nFrom:    {From}\nSubject: {Subject}\n{Body}",
                    to, email.From, subject, text);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[email] send failed");
        }
    }

    private async Task SendViaResendAsync(EmailOptions email, string to, string subject, string html, string text)
    {
        var client = httpClientFactory.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new("Bearer", email.ResendApiKey);
        request.Content = JsonContent.Create(new
        {
            from = email.From,
            to = new[] { to },
            subject,
            html,
            text,
        });
        var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Resend send failed ({(int)response.StatusCode}): {body}");
        }
    }

    private async Task SendViaSendGridAsync(EmailOptions email, string to, string subject, string html, string text)
    {
        var (fromName, fromEmail) = ParseFrom(email.From);
        var client = httpClientFactory.CreateClient(HttpClientName);
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.sendgrid.com/v3/mail/send");
        request.Headers.Authorization = new("Bearer", email.SendGridApiKey);
        request.Content = JsonContent.Create(new
        {
            personalizations = new[] { new { to = new[] { new { email = to } } } },
            from = new { email = fromEmail, name = fromName },
            subject,
            // SendGrid requires text/plain before text/html.
            content = new[]
            {
                new { type = "text/plain", value = text },
                new { type = "text/html", value = html },
            },
        });
        var response = await client.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException($"SendGrid send failed ({(int)response.StatusCode}): {body}");
        }
    }

    /// <summary>"Name &lt;addr@host&gt;" → (Name, addr@host); a bare address has no name.</summary>
    private static (string Name, string Email) ParseFrom(string from)
    {
        var open = from.LastIndexOf('<');
        var close = from.LastIndexOf('>');
        if (open >= 0 && close > open)
            return (from[..open].Trim(), from[(open + 1)..close].Trim());
        return (string.Empty, from.Trim());
    }

    private static string EscapeHtml(string s) => s
        .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");
}
