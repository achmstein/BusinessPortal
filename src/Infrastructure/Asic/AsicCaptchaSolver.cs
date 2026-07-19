using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.Asic;

/// <summary>2Captcha invisible reCAPTCHA v2 (Enterprise) solver — the ASIC Connect search
/// page is gated by an invisible reCAPTCHA. C# port of lib/asic-connect/captcha.ts. Each
/// solve burns real 2Captcha credit (~$0.003). Reads the key from config
/// <c>Asic:TwoCaptchaApiKey</c> or env <c>ASIC_2CAPTCHA_API_KEY</c>.</summary>
public sealed class AsicCaptchaSolver(IHttpClientFactory httpFactory, IConfiguration config, ILogger<AsicCaptchaSolver> logger)
{
    private const string InUrl = "https://2captcha.com/in.php";
    private const string ResUrl = "https://2captcha.com/res.php";

    // The invisible reCAPTCHA on the ASIC Connect search page (verified constants).
    private const string SiteKey = "6LdfxBoUAAAAAO7ItWGgMWT32_h5T_TtD4F1MflL";
    private const string Action = "userverify";

    public string? ApiKey =>
        config["Asic:TwoCaptchaApiKey"]?.Trim() is { Length: > 0 } k ? k
        : Environment.GetEnvironmentVariable("ASIC_2CAPTCHA_API_KEY")?.Trim() is { Length: > 0 } e ? e
        : null;

    public bool IsConfigured => !string.IsNullOrEmpty(ApiKey);

    private int TimeoutMs =>
        int.TryParse(config["Asic:CaptchaTimeoutMs"], out var n) && n > 0 ? n : 180_000;

    /// <summary>Submit the invisible reCAPTCHA to 2Captcha and poll until solved. Returns the
    /// g-recaptcha-response token to replay to ASIC.</summary>
    public async Task<string> SolveInvisibleRecaptchaAsync(string pageUrl, CancellationToken ct)
    {
        var key = ApiKey ?? throw new TwoCaptchaNotConfigured();
        using var http = httpFactory.CreateClient("asic-2captcha");

        // Step 1 — submit
        var submitBody = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["key"] = key,
            ["method"] = "userrecaptcha",
            ["googlekey"] = SiteKey,
            ["pageurl"] = pageUrl,
            ["invisible"] = "1",
            ["action"] = Action,
            ["json"] = "1",
        });
        using var submitResp = await http.PostAsync(InUrl, submitBody, ct);
        var submit = ParseResult(await submitResp.Content.ReadAsStringAsync(ct));
        if (submit.Status != 1)
            throw new CaptchaSolveFailed($"submit failed: {submit.Request}");
        var taskId = submit.Request;
        logger.LogInformation("2Captcha task {TaskId} submitted for {PageUrl}", taskId, pageUrl);

        // Step 2 — poll (15s initial delay per 2Captcha docs, then every 10s) until ready/timeout.
        var deadline = DateTime.UtcNow.AddMilliseconds(TimeoutMs);
        await Task.Delay(15_000, ct);
        while (DateTime.UtcNow < deadline)
        {
            ct.ThrowIfCancellationRequested();
            var pollUrl = $"{ResUrl}?key={Uri.EscapeDataString(key)}&action=get&id={taskId}&json=1";
            using var pollResp = await http.GetAsync(pollUrl, ct);
            var poll = ParseResult(await pollResp.Content.ReadAsStringAsync(ct));
            if (poll.Status == 1) return poll.Request;
            if (poll.Request != "CAPCHA_NOT_READY")
                throw new CaptchaSolveFailed($"poll error: {poll.Request}");
            await Task.Delay(10_000, ct);
        }
        throw new CaptchaSolveFailed("solve timed out");
    }

    private static (int Status, string Request) ParseResult(string body)
    {
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        var status = root.TryGetProperty("status", out var s) ? s.GetInt32() : 0;
        var request = root.TryGetProperty("request", out var r) ? r.GetString() ?? "" : "";
        return (status, request);
    }
}
