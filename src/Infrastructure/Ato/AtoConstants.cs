namespace BusinessPortal.Infrastructure.Ato;

/// <summary>Endpoints, headers and the User-Agent for the ATO myID auth client.
/// Ported from lib/ato/constants.ts (traced from Taxtron's Ato.Client). Values are
/// load-bearing — do not "tidy" them.</summary>
public static class AtoConstants
{
    private const string DefaultUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

    public static string GetUserAgent()
    {
        var ua = Environment.GetEnvironmentVariable("ATO_USER_AGENT")?.Trim();
        return string.IsNullOrEmpty(ua) ? DefaultUserAgent : ua;
    }

    public static int GetPollTimeoutMs()
    {
        return int.TryParse(Environment.GetEnvironmentVariable("ATO_POLL_TIMEOUT_MS"), out var n) && n > 0
            ? n
            : 5 * 60 * 1000;
    }

    public const int PollIntervalMs = 3000;

    // ─── Endpoints ───
    public const string BusinessPortalStart = "https://onlineservices.ato.gov.au/Business/ContextSelection";
    public const string PolicySession = "https://auth.identity.gov.au/sso/sps/apiauthsvc/policy/session";
    public const string PolicyAuthentication = "https://auth.identity.gov.au/sso/sps/apiauthsvc/policy/authentication";
    public const string PolicyAuthorisation = "https://auth.identity.gov.au/sso/sps/apiauthsvc/policy/authorisation";
    public const string IdpAuthentications = "https://api.identity.gov.au/exchange-api-customer/v1/idpauthentications";
    public const string MyIdSessions = "https://myid.gov.au/api/v1/Sessions";
    public const string MyIdHost = "https://myid.gov.au";
    public const string MyGovIdAcs = "https://mygovid.gov.au/core/myGovIdClient/Acs";
    public const string OAuthAuthorize = "https://auth.identity.gov.au/sso/sps/oauth/oauth20/authorize";
    public const string AtoAuthAcs = "https://auth.ato.gov.au/core2/atoAuthProvider/Acs";
    public const string AapOidcComplete = "https://auth.ato.gov.au/api/v1/aapOidcComplete";
    public const string SessionView = "https://onlineservices.ato.gov.au/api/v1/SessionView";
    public const string AccountTypes = "https://onlineservices.ato.gov.au/cdn/static-data/codes-tables/generic/ATOONLINE_ACC_TYPE.json";
    public const string AtoOnlineOrigin = "https://onlineservices.ato.gov.au";

    /// <summary>Identifiers/RelatedParties URL for the SessionView UPN → ABN walk.</summary>
    public static string IdentifiersRelatedPartiesUrl(string upn)
    {
        var filter = Uri.EscapeDataString("'relationshipTypeDecode=ABN,aBNIntermediaryRoleID=RA'");
        return $"{AtoOnlineOrigin}/api/v2/Identifiers/{Uri.EscapeDataString(upn)}/RelatedParties?Filter={filter}";
    }

    /// <summary>ABN/RelatedParties URL to fetch a RAN for a given ABN.</summary>
    public static string AbnRelatedPartiesUrl(string abn)
    {
        var filter = Uri.EscapeDataString("'relationshipTypeDecode=RAN'");
        var context = Uri.EscapeDataString($"'ABN={abn}'");
        return $"{AtoOnlineOrigin}/api/v2/ABN/{Uri.EscapeDataString(abn)}/RelatedParties?Filter={filter}&Context={context}";
    }

    // ─── Headers ───
    public const string AuditCallingAppVersion = "4.2.0.1";
    public const string AuditCallingAppName = "myGovIDAuthSPA";
    public const string RequestedWith = "XMLHttpRequest";

    public const string ApplicationDetailsValue =
        "CodeValues=true,softwareProductName=ATOOnline_ClientSummary,softwareProductVersion=1,softwareOrganisationName=ATO";

    /// <summary>The cookie that gates the authenticated ATO session; reused as the CSRF header value.</summary>
    public const string AtoSessionCookieName = "AtoAuthenticationSessionId";

    /// <summary>Our (the business) Registered Agent Number — the value clients search for
    /// when nominating us. Override via env OUR_AGENT_RAN.</summary>
    public static string OurAgentRan() =>
        Environment.GetEnvironmentVariable("OUR_AGENT_RAN") is { Length: > 0 } r ? r : "26260141";

    public const string ManualNominationUrl = "https://onlineservices.ato.gov.au/Business/Agentdetails#Nominate";
}
