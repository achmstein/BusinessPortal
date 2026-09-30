using Microsoft.AspNetCore.Identity;

namespace BusinessPortal.Infrastructure.Identity;

/// <summary>The identity user. Carries the app-specific flags that lived directly
/// on the original <c>User</c> (atoConnected, ATO nomination stamps) plus the owned
/// <see cref="UserProfile"/> and the client's collections. Email + password hash
/// come from <see cref="IdentityUser"/>. Admin access is role-based (see
/// <see cref="Roles"/>), not a flag on the user.</summary>
public class ApplicationUser : IdentityUser
{
    public bool AtoConnected { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Set when the agent nomination POST succeeded against OSfB.</summary>
    public DateTimeOffset? AtoNominatedAt { get; set; }

    /// <summary>ABN used as the nominator (the user may have several).</summary>
    public string? AtoNominatedFromAbn { get; set; }

    /// <summary>The hash of the random password an account gets when the portal creates
    /// it for a customer (Renewtron/Ontraport). While <c>PasswordHash</c> still equals it
    /// the customer has never chosen a password; any reset or change moves PasswordHash on,
    /// so no code path has to remember to clear this. Null for self-registered accounts.</summary>
    public string? GeneratedPasswordHash { get; set; }

    /// <summary>True while the account still has the password the portal generated.</summary>
    public bool NeedsPassword => GeneratedPasswordHash is not null && GeneratedPasswordHash == PasswordHash;

    /// <summary>Personal details — owned 1:1, stored as columns on the users table.</summary>
    public UserProfile Profile { get; set; } = new();

    public ICollection<BusinessEntity> Entities { get; set; } = new List<BusinessEntity>();
    public ICollection<BusinessName> BusinessNames { get; set; } = new List<BusinessName>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}
