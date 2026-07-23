using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BusinessPortal.Infrastructure.Identity;

/// <summary>Email settings. Ported from the original lib/email.ts adapter:
/// with no API key configured, emails are logged to the console instead of sent.</summary>
public sealed class EmailOptions
{
    public const string SectionName = "Email";

    public string From { get; set; } = "Business Portal <no-reply@localhost>";
    public string? ResendApiKey { get; set; }

    /// <summary>Public base URL used in emailed links (the original NEXT_PUBLIC_SITE_URL).</summary>
    public string SiteUrl { get; set; } = "http://localhost:5173";
}

/// <summary>Identity email sender backed by Resend (https://resend.com), ported from
/// the original lib/email.ts + forgot-password email copy. Send failures are logged,
/// not thrown — the forgot-password flow must not leak whether an email exists.</summary>
public sealed class ResendEmailSender(
    IHttpClientFactory httpClientFactory,
    IOptions<EmailOptions> options,
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
        var link = $"{options.Value.SiteUrl.TrimEnd('/')}/reset-password" +
                   $"?email={Uri.EscapeDataString(email)}&code={Uri.EscapeDataString(resetCode)}";
        return SendAsync(email, "Reset your Business Portal password",
            ResetHtml(NameOf(user), link), ResetText(NameOf(user), link));
    }

    private string NameOf(ApplicationUser user) =>
        string.IsNullOrWhiteSpace(user.Profile.FirstName) ? user.Email ?? "" : user.Profile.FirstName;

    // Copy ported verbatim from the original requestReset server action.
    private static string ResetHtml(string name, string link) =>
        $"<p>Hi {EscapeHtml(name)},</p>" +
        "<p>Someone (hopefully you) asked to reset the password on your Business Portal account.</p>" +
        "<p>Click the link below to choose a new one. The link expires in 1 hour.</p>" +
        $"<p><a href=\"{link}\">{link}</a></p>" +
        "<p>If you didn't request this, you can safely ignore this email.</p>";

    private static string ResetText(string name, string link) =>
        $"Hi {name},\n\nReset your Business Portal password: {link}\n\n" +
        "Link expires in 1 hour. If you didn't request this, ignore this email.";

    private async Task SendAsync(string to, string subject, string html, string text)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(options.Value.ResendApiKey))
            {
                var client = httpClientFactory.CreateClient(HttpClientName);
                using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
                request.Headers.Authorization = new("Bearer", options.Value.ResendApiKey);
                request.Content = JsonContent.Create(new
                {
                    from = options.Value.From,
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
            else
            {
                logger.LogInformation(
                    "📧 [EMAIL — console adapter; set Email:ResendApiKey to send for real]\n" +
                    "To:      {To}\nFrom:    {From}\nSubject: {Subject}\n{Body}",
                    to, options.Value.From, subject, text);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[email] send failed");
        }
    }

    private static string EscapeHtml(string s) => s
        .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");
}
