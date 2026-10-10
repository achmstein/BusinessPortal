namespace BusinessPortal.Domain.Entities;

/// <summary>A support message. Threaded via <see cref="ThreadId"/>
/// (falls back to the message id for legacy standalone messages).
/// <see cref="Created"/> is the original <c>createdAt</c>.</summary>
public class Message : BaseAuditableEntity
{
    public string UserId { get; set; } = string.Empty;

    /// <summary>Groups messages into a conversation. Null on legacy data —
    /// helpers treat it as the message's own id.</summary>
    public Guid? ThreadId { get; set; }

    /// <summary>Id of the message this one replies to, if any.</summary>
    public Guid? InReplyTo { get; set; }

    public MessageDirection Direction { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;

    /// <summary>Client-side read state.</summary>
    public bool Read { get; set; }

    /// <summary>Admin-side read state (for client-sent / outbound messages).</summary>
    public bool AdminRead { get; set; }

    /// <summary>Visible to staff only — never shown in the client's Messages section
    /// (e.g. an ASIC key request raised on the client's behalf).</summary>
    public bool StaffOnly { get; set; }
}
