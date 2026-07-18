namespace BusinessPortal.Domain.Enums;

/// <summary>Where a business entity's data came from: hand-entered by the client,
/// or synced from the ATO Business portal.</summary>
public enum EntitySource
{
    Manual = 0,
    Ato = 1,
}
