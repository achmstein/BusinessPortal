namespace BusinessPortal.Infrastructure.Ontraport;

public record MappedProfile(
    string FirstName, string LastName, string Phone, string Dob, string Tfn,
    string Address, string Suburb, string State, string Postcode);

public record MappedEntity(string Name, EntityType EntityType, string Abn, string Acn, string Industry);

public record MappedBusinessName(string Name, string Abn, string RenewalDate);

/// <summary>Normalised view of an Ontraport contact. Ported from lib/ontraport.ts
/// MappedContact.</summary>
public record MappedContact(
    string Email,
    MappedProfile Profile,
    MappedEntity? Entity,
    MappedBusinessName? BusinessName);
