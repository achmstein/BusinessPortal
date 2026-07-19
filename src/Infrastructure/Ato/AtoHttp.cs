using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace BusinessPortal.Infrastructure.Ato;

/// <summary>Cookie-jar + manual-redirect HTTP helper for the ATO auth chain — the C#
/// port of lib/ato/cookie-jar.ts. Uses a <see cref="CookieContainer"/> (multi-domain
/// jar) and a handler with AllowAutoRedirect=false so the chain can extract tokens from
/// intermediate redirect URLs. Short-lived (one per auth flow).</summary>
public sealed partial class AtoHttp : IDisposable
{
    private readonly HttpClient _http;
    public CookieContainer Jar { get; }

    public AtoHttp(CookieContainer? jar = null)
    {
        Jar = jar ?? new CookieContainer();
        var handler = new HttpClientHandler
        {
            AllowAutoRedirect = false,
            UseCookies = true,
            CookieContainer = Jar,
            AutomaticDecompression = DecompressionMethods.All,
        };
        _http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(60) };
    }

    /// <summary>One request with default ATO headers; redirects are NOT followed.
    /// Cookies are read/written to the jar automatically by the handler.</summary>
    public async Task<HttpResponseMessage> SendAsync(
        string url, HttpMethod method, HttpContent? content = null,
        IDictionary<string, string>? headers = null, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(method, url);
        if (content is not null) req.Content = content;

        // Defaults only when the caller didn't supply its own (the OSfB/Akamai calls
        // pass browser-specific Accept / Accept-Language and must not be doubled up).
        bool Has(string name) => headers is not null && headers.Keys.Any(k => string.Equals(k, name, StringComparison.OrdinalIgnoreCase));
        if (!Has("User-Agent")) req.Headers.TryAddWithoutValidation("User-Agent", AtoConstants.GetUserAgent());
        if (!Has("Accept")) req.Headers.TryAddWithoutValidation("Accept", "*/*");
        if (!Has("Accept-Language")) req.Headers.TryAddWithoutValidation("Accept-Language", "en-AU,en;q=0.9");
        if (headers is not null)
            foreach (var (k, v) in headers)
                req.Headers.TryAddWithoutValidation(k, v);

        return await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
    }

    /// <summary>Walk a 30x redirect chain. Returns the final response + the ordered list
    /// of redirect target URLs.</summary>
    public async Task<(HttpResponseMessage Final, List<string> RedirectUrls)> FollowRedirectsAsync(
        HttpResponseMessage initial, string baseUrl, int maxRedirects = 20, CancellationToken ct = default)
    {
        var urls = new List<string>();
        var resp = initial;
        while (IsRedirect(resp) && urls.Count < maxRedirects)
        {
            var location = resp.Headers.Location;
            if (location is null) break;
            var lastBase = urls.Count > 0 ? urls[^1] : baseUrl;
            var next = new Uri(new Uri(lastBase), location).ToString();
            urls.Add(next);
            resp.Dispose();
            resp = await SendAsync(next, HttpMethod.Get, ct: ct);
        }
        return (resp, urls);
    }

    public static bool IsRedirect(HttpResponseMessage r) =>
        (int)r.StatusCode is 301 or 302 or 303 or 307 or 308;

    /// <summary>Parse a response as JSON, throwing AtoReturnedHtml if the body looks like
    /// an HTML error/maintenance page (so callers get an actionable error).</summary>
    public static async Task<JsonElement> ParseJsonOrThrowAsync(HttpResponseMessage response, string url, CancellationToken ct = default)
    {
        var text = await response.Content.ReadAsStringAsync(ct);
        var trimmed = text.TrimStart();
        var snippet = trimmed.Length > 200 ? trimmed[..200] : trimmed;

        if (HtmlSniff().IsMatch(snippet))
            throw new AtoReturnedHtml(url, (int)response.StatusCode, snippet);

        try
        {
            using var doc = JsonDocument.Parse(text);
            return doc.RootElement.Clone();
        }
        catch (Exception ex)
        {
            throw new MalformedResponse(url, ex.Message, snippet);
        }
    }

    /// <summary>Last URL in a redirect chain (throws RedirectChainEmpty if empty).</summary>
    public static string LastRedirect(IReadOnlyList<string> chain, string stage) =>
        chain.Count == 0 ? throw new RedirectChainEmpty(stage) : chain[^1];

    /// <summary>URL-safe base64 decode (JWT payload segments).</summary>
    public static byte[] Base64UrlDecode(string s)
    {
        var padded = s.Replace('-', '+').Replace('_', '/');
        var pad = (4 - padded.Length % 4) % 4;
        return Convert.FromBase64String(padded + new string('=', pad));
    }

    /// <summary>Decode a JWT payload (segment[1]) as JSON. Null on any failure.</summary>
    public static JsonElement? DecodeJwtPayload(string jwt)
    {
        var parts = jwt.Split('.');
        if (parts.Length < 2) return null;
        try
        {
            var json = Encoding.UTF8.GetString(Base64UrlDecode(parts[1]));
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch
        {
            return null;
        }
    }

    public static Task Sleep(int ms, CancellationToken ct = default) => Task.Delay(ms, ct);

    // ─── Jar (de)serialization for encrypted persistence (AtoCookieStore) ───

    private sealed record CookieDto(string Name, string Value, string Domain, string Path, DateTime? Expires, bool Secure, bool HttpOnly);

    public static string SerializeJar(CookieContainer jar)
    {
        var dtos = jar.GetAllCookies()
            .Select(c => new CookieDto(c.Name, c.Value, c.Domain, string.IsNullOrEmpty(c.Path) ? "/" : c.Path,
                c.Expires == DateTime.MinValue ? null : c.Expires, c.Secure, c.HttpOnly))
            .ToList();
        return JsonSerializer.Serialize(dtos);
    }

    public static CookieContainer DeserializeJar(string json)
    {
        var jar = new CookieContainer();
        var dtos = JsonSerializer.Deserialize<List<CookieDto>>(json) ?? [];
        foreach (var d in dtos)
        {
            try
            {
                var cookie = new Cookie(d.Name, d.Value, d.Path, d.Domain) { Secure = d.Secure, HttpOnly = d.HttpOnly };
                if (d.Expires is { } exp) cookie.Expires = exp;
                jar.Add(cookie);
            }
            catch
            {
                // ignoreError parity with tough-cookie's setCookie({ ignoreError: true }).
            }
        }
        return jar;
    }

    public void Dispose() => _http.Dispose();

    [GeneratedRegex(@"^<(!doctype|html|body|head)", RegexOptions.IgnoreCase)]
    private static partial Regex HtmlSniff();
}
