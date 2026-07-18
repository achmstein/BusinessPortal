using System.Text.RegularExpressions;

namespace BusinessPortal.Infrastructure.Ontraport;

/// <summary>Maps an Ontraport webhook payload onto our shape. Ported faithfully
/// from lib/ontraport.ts (field keys, phone/postcode fallbacks, entity rollup,
/// date + entity-type normalisation).</summary>
public static partial class OntraportMapper
{
    // Ontraport field key → role. First non-empty source wins.
    private static readonly string[] Email = ["email"];
    private static readonly string[] FirstName = ["firstname"];
    private static readonly string[] LastName = ["lastname"];
    private static readonly string[] Phone = ["MobilePhon_232", "office_phone", "home_phone", "cell_phone"];
    private static readonly string[] Dob = ["DateOfBirt_233"];
    private static readonly string[] Tfn = ["TaxFileNum_269"];
    private static readonly string[] Address = ["address"];
    private static readonly string[] Suburb = ["Registered_208", "city"];
    private static readonly string[] State = ["State_234", "state"];
    private static readonly string[] Postcode = ["Postcode_236", "zip"];
    private static readonly string[] CompanyAbn = ["f5132"];
    private static readonly string[] CompanyAcn = ["f5471"];
    private static readonly string[] CompanyName = ["company"];
    private static readonly string[] CompanyIndustry = ["f4273"];
    private static readonly string[] EntityTypeRaw = ["f5151"];
    private static readonly string[] SoleTraderAbn = ["f4513"];
    private static readonly string[] BusinessNameName = ["f5062"];
    private static readonly string[] BusinessNameAbn = ["f5063"];
    private static readonly string[] BusinessNameRenewalDate = ["f5135"];

    public static MappedContact MapPayload(IReadOnlyDictionary<string, string> p)
    {
        var firstName = Pick(p, FirstName);
        var lastName = Pick(p, LastName);

        var pc = Pick(p, Postcode);
        var pcDigits = Digits(pc);

        var profile = new MappedProfile(
            FirstName: firstName,
            LastName: lastName,
            Phone: Pick(p, Phone),
            Dob: NormaliseDate(Pick(p, Dob)),
            Tfn: Digits(Pick(p, Tfn)),
            Address: Pick(p, Address),
            Suburb: Pick(p, Suburb),
            State: Pick(p, State),
            Postcode: pcDigits.Length > 0 ? pcDigits : pc);

        var companyAbn = Digits(Pick(p, CompanyAbn));
        var companyAcn = Digits(Pick(p, CompanyAcn));
        var companyName = Pick(p, CompanyName);
        var companyIndustry = Pick(p, CompanyIndustry);
        var entityType = MapEntityType(Pick(p, EntityTypeRaw));
        var soleTraderAbn = Digits(Pick(p, SoleTraderAbn));

        var entityAbn = entityType == BusinessPortal.Domain.Enums.EntityType.SoleTrader
            ? (soleTraderAbn.Length > 0 ? soleTraderAbn : companyAbn)
            : (companyAbn.Length > 0 ? companyAbn : soleTraderAbn);

        var entityName = companyName.Length > 0
            ? companyName
            : (entityType == BusinessPortal.Domain.Enums.EntityType.SoleTrader ? $"{firstName} {lastName}".Trim() : string.Empty);

        MappedEntity? entity = null;
        if (entityAbn.Length > 0 || entityName.Length > 0 || companyAcn.Length > 0
            || entityType != BusinessPortal.Domain.Enums.EntityType.Unspecified)
        {
            entity = new MappedEntity(
                Name: entityName.Length > 0 ? entityName : "(unnamed)",
                EntityType: entityType,
                Abn: entityAbn,
                Acn: companyAcn,
                Industry: companyIndustry);
        }

        var bnName = Pick(p, BusinessNameName);
        MappedBusinessName? businessName = bnName.Length > 0
            ? new MappedBusinessName(bnName, Digits(Pick(p, BusinessNameAbn)), NormaliseDate(Pick(p, BusinessNameRenewalDate)))
            : null;

        return new MappedContact(Pick(p, Email).ToLowerInvariant(), profile, entity, businessName);
    }

    private static string Pick(IReadOnlyDictionary<string, string> p, string[] sources)
    {
        foreach (var key in sources)
            if (p.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v))
                return v.Trim();
        return string.Empty;
    }

    /// <summary>Ontraport's free-text entity type onto our enum (Unspecified if unknown).</summary>
    public static EntityType MapEntityType(string raw)
    {
        var t = raw.ToLowerInvariant();
        if (t.Contains("sole")) return EntityType.SoleTrader;
        if (t.Contains("partner")) return EntityType.Partnership;
        if (t.Contains("compan") || t == "pty ltd" || t.Contains("ltd")) return EntityType.Company;
        if (t.Contains("trust")) return EntityType.Trust;
        return EntityType.Unspecified;
    }

    /// <summary>ISO / mm-dd-yyyy / Unix-seconds → YYYY-MM-DD (or "").</summary>
    public static string NormaliseDate(string raw)
    {
        if (string.IsNullOrEmpty(raw)) return string.Empty;

        if (UnixSeconds().IsMatch(raw) && long.TryParse(raw, out var secs))
            return DateTimeOffset.FromUnixTimeSeconds(secs).UtcDateTime.ToString("yyyy-MM-dd");

        var iso = IsoDate().Match(raw);
        if (iso.Success) return iso.Groups[1].Value;

        var us = UsDate().Match(raw);
        if (us.Success)
            return $"{us.Groups[3].Value}-{us.Groups[1].Value.PadLeft(2, '0')}-{us.Groups[2].Value.PadLeft(2, '0')}";

        return string.Empty;
    }

    private static string Digits(string s) => NonDigits().Replace(s, string.Empty);

    [GeneratedRegex(@"^\d{9,10}$")] private static partial Regex UnixSeconds();
    [GeneratedRegex(@"^(\d{4}-\d{2}-\d{2})")] private static partial Regex IsoDate();
    [GeneratedRegex(@"^(\d{1,2})/(\d{1,2})/(\d{4})$")] private static partial Regex UsDate();
    [GeneratedRegex(@"[^0-9]")] private static partial Regex NonDigits();
}
