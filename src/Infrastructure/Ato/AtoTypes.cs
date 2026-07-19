namespace BusinessPortal.Infrastructure.Ato;

/// <summary>An agent the authenticated user can act for (name/abn/ran). Ported from
/// the original AtoAgent.</summary>
public record AtoAgent(string Name, string Abn, string Ran);

/// <summary>In-flight state carried between beginAuth (stages 1–4) and waitForApproval
/// (stages 5–7). Serialized (encrypted) into the link-attempt row. Ported from the
/// original AuthFlowState.</summary>
public record AuthFlowState
{
    public string Email { get; init; } = string.Empty;
    public string Nonce { get; init; } = string.Empty;
    public string ClientId { get; init; } = string.Empty;
    public string State { get; init; } = string.Empty;
    public string RpAuthId { get; init; } = string.Empty;
    public string IdpAuthenticationId { get; init; } = string.Empty;
    public string GToken { get; init; } = string.Empty;
    public string AccessToken { get; init; } = string.Empty;
    public string OpenIdSessionId { get; init; } = string.Empty;
    public string AuthenticationResponseUrl { get; init; } = string.Empty;
    public string CookiesJson { get; init; } = string.Empty;
    public string Jti { get; init; } = string.Empty;
}
