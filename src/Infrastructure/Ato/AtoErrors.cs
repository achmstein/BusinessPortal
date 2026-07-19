namespace BusinessPortal.Infrastructure.Ato;

/// <summary>Typed errors for the ATO auth client — ported from lib/ato/errors.ts.
/// Named so operators can tell "ATO returned HTML" from "redirect chain too short".</summary>
public class AtoAuthError(string code, string message, IReadOnlyDictionary<string, object?>? context = null)
    : Exception(message)
{
    public string Code { get; } = code;
    public IReadOnlyDictionary<string, object?> Context { get; } = context ?? new Dictionary<string, object?>();
}

public sealed class RedirectChainTooShort(string stage, int expected, int got, IReadOnlyList<string> urls)
    : AtoAuthError("REDIRECT_CHAIN_TOO_SHORT",
        $"[ATO {stage}] expected at least {expected} redirects, got {got}. The ATO/myID flow likely changed.",
        new Dictionary<string, object?> { ["stage"] = stage, ["expected"] = expected, ["got"] = got, ["urls"] = urls });

public sealed class RedirectChainEmpty(string stage)
    : AtoAuthError("REDIRECT_CHAIN_EMPTY", $"[ATO {stage}] redirect chain was empty.",
        new Dictionary<string, object?> { ["stage"] = stage });

public sealed class AtoReturnedHtml(string url, int status, string snippet)
    : AtoAuthError("ATO_RETURNED_HTML",
        $"[ATO {url}] returned HTML where JSON was expected (HTTP {status}). The ATO may be down or the endpoint changed.",
        new Dictionary<string, object?> { ["url"] = url, ["status"] = status, ["snippet"] = snippet });

public sealed class MalformedResponse(string url, string message, string snippet)
    : AtoAuthError("MALFORMED_RESPONSE", $"[ATO {url}] {message}",
        new Dictionary<string, object?> { ["url"] = url, ["snippet"] = snippet });

public sealed class MissingJsonField(string url, string field)
    : AtoAuthError("MISSING_JSON_FIELD", $"[ATO {url}] required field \"{field}\" missing from response.",
        new Dictionary<string, object?> { ["url"] = url, ["field"] = field });

public sealed class MissingQueryParam(string stage, string url, string param)
    : AtoAuthError("MISSING_QUERY_PARAM", $"[ATO {stage}] redirect URL missing query parameter \"{param}\".",
        new Dictionary<string, object?> { ["stage"] = stage, ["url"] = url, ["param"] = param });

public sealed class FormElementMissing(string url, string name, string htmlSnippet)
    : AtoAuthError("FORM_ELEMENT_MISSING", $"[ATO {url}] required form element <input name=\"{name}\"> not found.",
        new Dictionary<string, object?> { ["url"] = url, ["name"] = name, ["htmlSnippet"] = htmlSnippet });

public sealed class ProviderTokenMissing(string url)
    : AtoAuthError("PROVIDER_TOKEN_MISSING", "[ATO myID] providerToken fragment not found in URL.",
        new Dictionary<string, object?> { ["url"] = url });

public sealed class ApprovalTimedOut(int timeoutMs)
    : AtoAuthError("APPROVAL_TIMED_OUT",
        $"Approval not received within {timeoutMs / 1000}s. The user probably didn't approve the request on their myID app.",
        new Dictionary<string, object?> { ["timeoutMs"] = timeoutMs });

public sealed class InvalidPollToken(string reason)
    : AtoAuthError("INVALID_POLL_TOKEN", $"Invalid pollToken: {reason}", new Dictionary<string, object?> { ["reason"] = reason });

public sealed class CookieSessionInvalid(int status)
    : AtoAuthError("COOKIE_SESSION_INVALID", $"Cached ATO session no longer valid (SessionView HTTP {status}).",
        new Dictionary<string, object?> { ["status"] = status });

public sealed class AtoChainError(string stage, object? cause)
    : AtoAuthError("ATO_CHAIN_ERROR",
        $"[ATO {stage}] {(cause is Exception e ? e.Message : cause as string ?? "unknown")}",
        new Dictionary<string, object?> { ["stage"] = stage, ["cause"] = cause is Exception ce ? ce.Message : cause });
