namespace BusinessPortal.Domain.Entities;

/// <summary>Personal details for a client. Owned 1:1 by the identity user
/// (stored as columns on the users table). Mirrors the original <c>Profile</c>
/// (email lives on the identity user, not here).</summary>
public class UserProfile
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Dob { get; set; } = string.Empty;
    public string Tfn { get; set; } = string.Empty;
    public string Abn { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Suburb { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Postcode { get; set; } = string.Empty;
}
