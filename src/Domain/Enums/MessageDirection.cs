namespace BusinessPortal.Domain.Enums;

/// <summary>Direction of a support message relative to the client.
/// Outbound = client -> support; Inbound = support -> client.</summary>
public enum MessageDirection
{
    Outbound = 0,
    Inbound = 1,
}
