using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AngleSharp.Html.Parser;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.Ato;

public record BeginAuthResult(string ReferenceCode, AuthFlowState State);
public record WaitForApprovalResult(IReadOnlyList<AtoAgent> Agents, string CookiesJson);
public record AtoCookieAuthResult(bool Ok, IReadOnlyList<AtoAgent> Agents, string CookiesJson, string? Reason);

/// <summary>ATO myID auth client — C# port of lib/ato/auth-client.ts (itself a port of
/// Taxtron's Ato.Client/AtoClient.cs). Two paths:
///  - <see cref="AuthenticateWithCookiesAsync"/> (Path A): validate a stored cookie jar
///    via SessionView; return the agent list if still good.
///  - <see cref="BeginAuthAsync"/> + <see cref="WaitForApprovalAsync"/> (Path B): the full
///    OAuth chain. BeginAuth returns a 4-digit code for the user to approve on their phone;
///    WaitForApproval polls until approval then completes the chain.
///
/// UNVERIFIED against a live myID account (credential-gated). Faithful line-by-line to the
/// original; the redirect-walking, header-swapping, custom <c>params</c> header, JWT decode
/// of segment[1] and the <c>AtoCsrfHeader = session cookie</c> derivation are all
/// load-bearing — do not "simplify".</summary>
public sealed partial class AtoAuthClient(ILogger<AtoAuthClient> logger)
{
    private readonly ILogger<AtoAuthClient> _logger = logger;

    /* ───────────────────────── Path B Stage 1–4 ───────────────────────── */

    /// <summary>Stages 1–4 of the OAuth chain. Returns the 4-digit reference code (to show
    /// the user) and the AuthFlowState (to feed into <see cref="WaitForApprovalAsync"/>).</summary>
    public async Task<BeginAuthResult> BeginAuthAsync(string email, CancellationToken ct = default)
    {
        using var http = new AtoHttp();
        _logger.LogInformation("ATO beginAuth started for {Email}", email);

        /* ── Stage 1 — discover OIDC params from the business-portal redirect chain ── */
        var stage1Initial = await http.SendAsync(AtoConstants.BusinessPortalStart, HttpMethod.Get, ct: ct);
        var (stage1Final, stage1Urls) = await http.FollowRedirectsAsync(stage1Initial, AtoConstants.BusinessPortalStart, ct: ct);
        stage1Final.Dispose();

        if (stage1Urls.Count < 3)
            throw new RedirectChainTooShort("stage-1", 3, stage1Urls.Count, stage1Urls);

        var signin = QueryParam(stage1Urls[2], "signin")
            ?? throw new MissingQueryParam("stage-1", stage1Urls[2], "signin");

        var lastStage1 = stage1Urls[^1];
        var nonce = QueryParam(lastStage1, "nonce");
        var clientId = QueryParam(lastStage1, "client_id");
        var oidcState = QueryParam(lastStage1, "state");
        if (nonce is null || clientId is null || oidcState is null)
            throw new MissingQueryParam("stage-1", lastStage1,
                nonce is null ? "nonce" : clientId is null ? "client_id" : "state");

        /* ── Stage 2 — policy session → gToken ── */
        using var policySession = await http.SendAsync(AtoConstants.PolicySession, HttpMethod.Get, ct: ct);
        var psJson = await AtoHttp.ParseJsonOrThrowAsync(policySession, AtoConstants.PolicySession, ct);
        var authorizationToken = RequireString(psJson, "token", AtoConstants.PolicySession);

        var rpAuthId = Guid.NewGuid().ToString();
        var policyAuthBody = Json(new
        {
            action = "authentication",
            id = rpAuthId,
            @params = new
            {
                redirect_uri = AtoConstants.AapOidcComplete,
                response_mode = "query",
                response_type = "code",
                scope = "openid profile email",
                state = oidcState,
                nonce,
                client_id = clientId,
                display = "no_transitions",
            },
        });
        using var policyAuth = await http.SendAsync(AtoConstants.PolicyAuthentication, HttpMethod.Post,
            policyAuthBody, Bearer(authorizationToken), ct);
        var policyAuthJson = await AtoHttp.ParseJsonOrThrowAsync(policyAuth, AtoConstants.PolicyAuthentication, ct);
        var gToken = RequireString(policyAuthJson, "token", AtoConstants.PolicyAuthentication);

        /* ── Stage 3 — IDP authentication handshake ── */
        var idpAuthenticationId = Guid.NewGuid().ToString();
        using (await http.SendAsync(AtoConstants.IdpAuthentications, HttpMethod.Post,
            Json(new { id = idpAuthenticationId, rpAuthId, idpId = 1, @params = new { } }), Bearer(gToken), ct))
        { /* response body unused */ }

        var idpDetailsUrl = $"{AtoConstants.IdpAuthentications}/{idpAuthenticationId}";
        using var idpDetails = await http.SendAsync(idpDetailsUrl, HttpMethod.Get, headers: Bearer(gToken), ct: ct);
        var idpDetailsJson = await AtoHttp.ParseJsonOrThrowAsync(idpDetails, idpDetailsUrl, ct);
        var idpFullUrl = RequireString(idpDetailsJson, "fullURL", idpDetailsUrl);

        var idpFollowStart = await http.SendAsync(idpFullUrl, HttpMethod.Post, JsonRaw("{}"), Bearer(gToken), ct);

        // First follow the Location header from that POST, THEN walk the redirect chain.
        var stage3First = idpFollowStart;
        if (stage3First.Headers.Location is { } firstLoc)
        {
            var nextUrl = new Uri(new Uri(idpFullUrl), firstLoc).ToString();
            stage3First.Dispose();
            stage3First = await http.SendAsync(nextUrl, HttpMethod.Get, ct: ct);
        }

        var (stage3Final, stage3Urls) = await http.FollowRedirectsAsync(stage3First, idpFullUrl, ct: ct);
        stage3Final.Dispose();
        if (stage3Urls.Count < 1)
            throw new RedirectChainTooShort("stage-3", 1, stage3Urls.Count, stage3Urls);

        _ = QueryParam(stage3Urls[0], "signin")
            ?? throw new MissingQueryParam("stage-3", stage3Urls[0], "signin");
        var signinStage3 = QueryParam(stage3Urls[0], "signin")!;

        /* ── Stage 4 — myID audit headers + provider token + AuthenticationRequest ── */
        var providerMatch = ProviderTokenRegex().Match(stage3Urls[^1]);
        if (!providerMatch.Success)
            throw new ProviderTokenMissing(stage3Urls[^1]);
        var providerToken = Uri.UnescapeDataString(providerMatch.Groups[1].Value);

        var sessionsHeaders = AuditHeaders();
        sessionsHeaders[AtoConstants.HdrAuditRequestId] = Guid.NewGuid().ToString();
        sessionsHeaders[AtoConstants.HdrAuditSessionId] = signinStage3;
        sessionsHeaders["Authorization"] = $"Bearer {authorizationToken}";
        using var sessionsResp = await http.SendAsync(AtoConstants.MyIdSessions, HttpMethod.Post,
            Json(new { data = providerToken }), sessionsHeaders, ct);
        var sessionsJson = await AtoHttp.ParseJsonOrThrowAsync(sessionsResp, AtoConstants.MyIdSessions, ct);

        var accessToken = RequireString(sessionsJson, "accessToken", AtoConstants.MyIdSessions);
        var openIdSessionId = RequireString(sessionsJson, "openIdSessionId", AtoConstants.MyIdSessions);

        var jwtPayload = AtoHttp.DecodeJwtPayload(accessToken);
        var jti = jwtPayload is { } p1 && p1.TryGetProperty("jti", out var jtiEl) && jtiEl.ValueKind == JsonValueKind.String
            ? jtiEl.GetString()! : "";
        var sub = jwtPayload is { } p2 && p2.TryGetProperty("sub", out var subEl) && subEl.ValueKind == JsonValueKind.String
            ? subEl.GetString() : null;
        if (string.IsNullOrEmpty(sub))
            throw new MissingJsonField(AtoConstants.MyIdSessions, "accessToken.sub (JWT)");
        authorizationToken = accessToken;

        // 4-digit reference code we show to the user to type into their phone.
        var referenceCode = Random.Shared.Next(1000, 10000).ToString();

        var authRequestUrl = $"{AtoConstants.MyIdSessions}/{Uri.EscapeDataString(sub)}/AuthenticationRequest";
        var authReqHeaders = AuditHeaders();
        authReqHeaders[AtoConstants.HdrAuditRequestId] = Guid.NewGuid().ToString();
        authReqHeaders[AtoConstants.HdrAuditSessionId] = jti;
        authReqHeaders["Authorization"] = $"Bearer {authorizationToken}";
        using var authRequest = await http.SendAsync(authRequestUrl, HttpMethod.Post,
            Json(new { rememberMeFlag = true, referenceCode, accountName = email }), authReqHeaders, ct);

        var location = authRequest.Headers.Location
            ?? throw new MissingJsonField(authRequestUrl, "Location header");
        var authenticationResponseUrl = new Uri(new Uri(AtoConstants.MyIdHost), location).ToString();

        var flow = new AuthFlowState
        {
            Email = email,
            Nonce = nonce,
            ClientId = clientId,
            State = oidcState,
            RpAuthId = rpAuthId,
            IdpAuthenticationId = idpAuthenticationId,
            GToken = gToken,
            AccessToken = accessToken,
            OpenIdSessionId = openIdSessionId,
            AuthenticationResponseUrl = authenticationResponseUrl,
            CookiesJson = AtoHttp.SerializeJar(http.Jar),
            Jti = jti,
        };

        _logger.LogInformation("ATO Stage 4 done — 4-digit code {Code} returned to user", referenceCode);
        return new BeginAuthResult(referenceCode, flow);
    }

    /* ───────────────────────── Path B Stage 5–7 ───────────────────────── */

    /// <summary>Poll the AuthenticationResponses endpoint until the user approves on their
    /// phone. Returns the userSignInToken.</summary>
    private async Task<string> PollForUserSignInTokenAsync(
        AtoHttp http, string authenticationResponseUrl, int timeoutMs, int pollIntervalMs,
        string jti, string accessToken, CancellationToken ct)
    {
        var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
        var pollUrl = $"{authenticationResponseUrl}/AuthenticationResponses";
        var headers = AuditHeaders();
        headers[AtoConstants.HdrAuditRequestId] = Guid.NewGuid().ToString();
        headers[AtoConstants.HdrAuditSessionId] = jti;
        // CRITICAL: myID rejects polls without the access-token Bearer.
        headers["Authorization"] = $"Bearer {accessToken}";

        while (DateTime.UtcNow < deadline)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                using var resp = await http.SendAsync(pollUrl, HttpMethod.Get, headers: headers, ct: ct);
                if (resp.IsSuccessStatusCode)
                {
                    var json = await AtoHttp.ParseJsonOrThrowAsync(resp, pollUrl, ct);
                    if (json.TryGetProperty("userSignInToken", out var t) && t.ValueKind == JsonValueKind.String
                        && t.GetString() is { Length: > 0 } token)
                        return token;
                    // 200 but field missing: not approved yet; wait and try again.
                }
            }
            catch (OperationCanceledException) { throw; }
            catch (AtoReturnedHtml) { /* maintenance page — keep polling */ }
            catch (Exception) { /* transient — keep polling within timeout */ }

            await AtoHttp.Sleep(pollIntervalMs, ct);
        }
        throw new ApprovalTimedOut(timeoutMs);
    }

    /// <summary>Stages 5–7: poll for approval, then drive the user back through ACS and the
    /// second authorisation handshake until we land authenticated in the Business portal.
    /// Returns the agent list + cookie jar ready for storage.</summary>
    public async Task<WaitForApprovalResult> WaitForApprovalAsync(
        AuthFlowState state, int? timeoutMs = null, int? pollIntervalMs = null, CancellationToken ct = default)
    {
        using var http = new AtoHttp(AtoHttp.DeserializeJar(state.CookiesJson));
        var timeout = timeoutMs ?? AtoConstants.GetPollTimeoutMs();
        var interval = pollIntervalMs ?? AtoConstants.PollIntervalMs;

        /* ── Stage 5 — wait for user approval on phone ── */
        _logger.LogInformation("ATO Stage 5 — polling myID for user approval");
        var userSignInToken = await PollForUserSignInTokenAsync(
            http, state.AuthenticationResponseUrl, timeout, interval, state.Jti, state.AccessToken, ct);

        // POST to mygovid.gov.au ACS with form-encoded body, then follow redirects.
        var acsResp = await http.SendAsync(AtoConstants.MyGovIdAcs, HttpMethod.Post,
            Form(new Dictionary<string, string> { ["id_token"] = userSignInToken, ["session_id"] = state.OpenIdSessionId }),
            new Dictionary<string, string> { ["Authorization"] = $"Bearer {state.AccessToken}" }, ct);
        var (acsFinal, acsUrls) = await http.FollowRedirectsAsync(acsResp, AtoConstants.MyGovIdAcs, ct: ct);
        acsFinal.Dispose();
        var finalAcsUrl = acsUrls.Count > 0 ? acsUrls[^1] : AtoConstants.MyGovIdAcs;
        var acsNonce = QueryParam(finalAcsUrl, "nonce")
            ?? throw new MissingQueryParam("stage-5", finalAcsUrl, "nonce");

        /* ── Stage 6 — authorisation token swap + userclaims + consent ── */
        _logger.LogInformation("ATO Stage 6 — authorisation swap + consent");
        using var authorisationResp = await http.SendAsync(AtoConstants.PolicyAuthorisation, HttpMethod.Post,
            Json(new { nonce = acsNonce }), Bearer(state.GToken), ct);
        var authorisationJson = await AtoHttp.ParseJsonOrThrowAsync(authorisationResp, AtoConstants.PolicyAuthorisation, ct);
        var newAuthToken = RequireString(authorisationJson, "token", AtoConstants.PolicyAuthorisation);

        var userClaimsUrl = $"{AtoConstants.IdpAuthentications}/{state.IdpAuthenticationId}/rpauthentications/{state.RpAuthId}/userclaims";
        using (await http.SendAsync(userClaimsUrl, HttpMethod.Options, ct: ct)) { /* preflight */ }
        using var userClaimsResp = await http.SendAsync(userClaimsUrl, HttpMethod.Get, headers: Bearer(newAuthToken), ct: ct);
        var userClaimsJson = await AtoHttp.ParseJsonOrThrowAsync(userClaimsResp, userClaimsUrl, ct);
        var idpAuthId = RequireString(userClaimsJson, "idpAuthId", userClaimsUrl);

        var consentUrl = $"https://api.identity.gov.au/exchange-api-customer/v1/rpauthentications/{state.RpAuthId}/consent";
        using (await http.SendAsync(consentUrl, HttpMethod.Options, ct: ct)) { /* preflight */ }
        using (await http.SendAsync(consentUrl, HttpMethod.Put,
            Json(new { id = idpAuthId, storeConsent = false, apAuthId = (string?)null }), Bearer(newAuthToken), ct))
        { /* response body unused */ }

        /* ── Stage 7 — OAuth authorize → ATO Acs → final cookie set ── */
        _logger.LogInformation("ATO Stage 7 — OAuth authorize → ATO ACS → land in business portal");
        // OIDC params go in a custom `params` HEADER (unusual but verified against Taxtron).
        var paramsHeader = string.Join("&", new[]
        {
            $"redirect_uri={Uri.EscapeDataString(AtoConstants.AapOidcComplete)}",
            "response_mode=query",
            "response_type=code",
            "scope=openid+profile+email",
            $"state={Uri.EscapeDataString(state.State)}",
            $"nonce={Uri.EscapeDataString(state.Nonce)}",
            $"client_id={Uri.EscapeDataString(state.ClientId)}",
            "display=no_transitions",
        });

        using var authorizeResp = await http.SendAsync(AtoConstants.OAuthAuthorize, HttpMethod.Post, JsonRaw("{}"),
            new Dictionary<string, string> { ["Authorization"] = $"Bearer {newAuthToken}", ["params"] = paramsHeader }, ct);
        var authorizeLocation = authorizeResp.Headers.Location
            ?? throw new MissingJsonField(AtoConstants.OAuthAuthorize, "Location header");

        using var formPageResp = await http.SendAsync(
            new Uri(new Uri(AtoConstants.OAuthAuthorize), authorizeLocation).ToString(), HttpMethod.Get, ct: ct);
        var htmlText = await formPageResp.Content.ReadAsStringAsync(ct);

        var doc = new HtmlParser().ParseDocument(htmlText);
        var idToken = doc.QuerySelector("input[name='id_token']")?.GetAttribute("value");
        var sessionId = doc.QuerySelector("input[name='session_id']")?.GetAttribute("value");
        var snippet = htmlText.Length > 200 ? htmlText[..200] : htmlText;
        if (string.IsNullOrEmpty(idToken))
            throw new FormElementMissing(authorizeLocation.ToString(), "id_token", snippet);
        if (string.IsNullOrEmpty(sessionId))
            throw new FormElementMissing(authorizeLocation.ToString(), "session_id", snippet);

        var finalAcsResp = await http.SendAsync(AtoConstants.AtoAuthAcs, HttpMethod.Post,
            Form(new Dictionary<string, string> { ["id_token"] = idToken, ["error"] = "", ["session_id"] = sessionId }),
            ct: ct);
        var (finalAcsChain, _) = await http.FollowRedirectsAsync(finalAcsResp, AtoConstants.AtoAuthAcs, ct: ct);
        finalAcsChain.Dispose();

        _logger.LogInformation("ATO Stage 7 done — loading agents");
        var agents = await AtoAgents.LoadAgentsAsync(http, ct);
        var cookiesJson = AtoHttp.SerializeJar(http.Jar);
        _logger.LogInformation("ATO waitForApproval complete — {Count} agent(s) loaded", agents.Count);
        return new WaitForApprovalResult(agents, cookiesJson);
    }

    /* ───────────────────────── Path A — cookie reuse ───────────────────────── */

    /// <summary>Validate a stored cookie jar via SessionView; return the agent list if the
    /// session is still good. Never throws for expected auth failures — returns Ok=false.</summary>
    public async Task<AtoCookieAuthResult> AuthenticateWithCookiesAsync(string cookiesJson, CancellationToken ct = default)
    {
        CookieContainer jar;
        try
        {
            jar = AtoHttp.DeserializeJar(cookiesJson);
        }
        catch
        {
            return new AtoCookieAuthResult(false, [], "", "stored cookie jar could not be parsed");
        }

        using var http = new AtoHttp(jar);
        try
        {
            var headers = AtoAgents.BuildAuthenticatedHeaders(http.Jar);
            using var resp = await http.SendAsync(AtoConstants.SessionView, HttpMethod.Get, headers: headers, ct: ct);
            if (!resp.IsSuccessStatusCode)
                return new AtoCookieAuthResult(false, [], "", $"SessionView returned {(int)resp.StatusCode}");

            var agents = await AtoAgents.LoadAgentsAsync(http, ct);
            return new AtoCookieAuthResult(true, agents, AtoHttp.SerializeJar(http.Jar), null);
        }
        catch (AtoAuthError e)
        {
            // CookieSessionInvalid / AtoReturnedHtml / MissingJsonField / AtoChainError all
            // mean "this cached session is no good" — surface the reason, don't throw.
            return new AtoCookieAuthResult(false, [], "", e.Message);
        }
    }

    /* ───────────────────────── helpers ───────────────────────── */

    private static StringContent Json(object body) =>
        new(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

    private static StringContent JsonRaw(string raw) =>
        new(raw, Encoding.UTF8, "application/json");

    private static FormUrlEncodedContent Form(IEnumerable<KeyValuePair<string, string>> kv) => new(kv);

    private static Dictionary<string, string> Bearer(string token) =>
        new() { ["Authorization"] = $"Bearer {token}" };

    private static Dictionary<string, string> AuditHeaders() => new()
    {
        [AtoConstants.HdrAuditCallingAppVersion] = AtoConstants.AuditCallingAppVersion,
        [AtoConstants.HdrAuditCallingAppName] = AtoConstants.AuditCallingAppName,
        [AtoConstants.HdrRequestedWith] = AtoConstants.RequestedWith,
    };

    /// <summary>Extract a query-string parameter from a full URL (null if absent).</summary>
    private static string? QueryParam(string url, string key)
    {
        var query = new Uri(url).Query;
        return QueryHelpers.ParseQuery(query).TryGetValue(key, out var v) ? v.ToString() : null;
    }

    /// <summary>Read a required non-empty string field or throw <see cref="MissingJsonField"/>.</summary>
    private static string RequireString(JsonElement el, string prop, string url)
    {
        if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v)
            && v.ValueKind == JsonValueKind.String && v.GetString() is { Length: > 0 } s)
            return s;
        throw new MissingJsonField(url, prop);
    }

    [GeneratedRegex("#providerToken=([^&]+)")]
    private static partial Regex ProviderTokenRegex();
}
