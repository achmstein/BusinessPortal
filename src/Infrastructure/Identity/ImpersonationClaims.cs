namespace BusinessPortal.Infrastructure.Identity;

/// <summary>Claim types stamped into the auth cookie while an admin is impersonating
/// a client. The cookie identity IS the target (so `/admin/*` isolation works by
/// construction — the target isn't in the Admin role); these claims remember who to
/// return to.</summary>
public static class ImpersonationClaims
{
    public const string Impersonating = "impersonating";
    public const string OriginalAdminId = "original_admin_id";
    public const string LogId = "impersonation_log_id";
}
