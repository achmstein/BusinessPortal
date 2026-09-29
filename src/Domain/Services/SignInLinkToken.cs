using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace BusinessPortal.Domain.Services;

/// <summary>
/// One-click sign-in link tokens, shared with Renewtron (which puts them in its
/// renewal confirmation email) and must stay byte-compatible with its
/// PortalLinks.CreateSignInToken:
///
///   P = base64url(UTF8({"email":"…","exp":&lt;unix seconds&gt;,"jti":"&lt;guid N&gt;"}))
///   S = base64url(HMACSHA256(UTF8(key), ASCII(P)))
///   token = P + "." + S
///
/// The token proves who it was issued for and until when. Single use is enforced
/// by the caller recording the jti.
/// </summary>
public static class SignInLinkToken
{
    public sealed record Claims(string Email, DateTimeOffset Expires, string Jti);

    public enum Failure { None, Malformed, BadSignature, Expired }

    public static string Create(string email, string key, DateTimeOffset expires, Guid jti)
    {
        var payload = JsonSerializer.Serialize(new Payload(
            email.Trim().ToLowerInvariant(), expires.ToUnixTimeSeconds(), jti.ToString("N")));
        var p = Base64Url(Encoding.UTF8.GetBytes(payload));
        return p + "." + Sign(p, key);
    }

    public static Failure TryRead(string? token, string key, DateTimeOffset now, out Claims? claims)
    {
        claims = null;
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrEmpty(key)) return Failure.Malformed;

        var dot = token.IndexOf('.');
        if (dot <= 0 || dot == token.Length - 1 || token.IndexOf('.', dot + 1) >= 0) return Failure.Malformed;
        var p = token[..dot];
        var s = token[(dot + 1)..];

        // Constant-time: a signature must not be guessable byte by byte.
        var expected = Encoding.ASCII.GetBytes(Sign(p, key));
        if (!CryptographicOperations.FixedTimeEquals(expected, Encoding.ASCII.GetBytes(s)))
            return Failure.BadSignature;

        Payload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<Payload>(FromBase64Url(p));
        }
        catch (Exception ex) when (ex is JsonException or FormatException)
        {
            return Failure.Malformed;
        }
        if (payload is null || string.IsNullOrWhiteSpace(payload.email) || string.IsNullOrWhiteSpace(payload.jti))
            return Failure.Malformed;

        var expires = DateTimeOffset.FromUnixTimeSeconds(payload.exp);
        if (expires <= now) return Failure.Expired;

        claims = new Claims(payload.email.Trim().ToLowerInvariant(), expires, payload.jti);
        return Failure.None;
    }

    // Lower-case property names are the wire format — see the class summary.
    private sealed record Payload(string email, long exp, string jti);

    private static string Sign(string p, string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return Base64Url(hmac.ComputeHash(Encoding.ASCII.GetBytes(p)));
    }

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromBase64Url(string value)
    {
        var s = value.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + (4 - s.Length % 4) % 4, '='));
    }
}
