namespace BusinessPortal.Domain.Enums;

/// <summary>Business entity type. Mirrors the original union
/// "Sole Trader" | "Partnership" | "Company" | "Trust" | "" — the empty string
/// maps to <see cref="Unspecified"/>. ACN is only meaningful for Company/Trust.</summary>
public enum EntityType
{
    Unspecified = 0,
    SoleTrader = 1,
    Partnership = 2,
    Company = 3,
    Trust = 4,
}
