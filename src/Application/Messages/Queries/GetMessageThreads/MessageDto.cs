namespace BusinessPortal.Application.Messages.Queries.GetMessageThreads;

public record MessageDto
{
    public Guid Id { get; init; }
    public Guid ThreadId { get; init; }
    public Guid? InReplyTo { get; init; }
    public string Direction { get; init; } = string.Empty;
    public string Subject { get; init; } = string.Empty;
    public string Body { get; init; } = string.Empty;
    public bool Read { get; init; }
    public bool AdminRead { get; init; }
    public DateTimeOffset CreatedAt { get; init; }

    public static MessageDto FromEntity(Message m) => new()
    {
        Id = m.Id,
        // threadIdOf: fall back to the message's own id for legacy/standalone messages.
        ThreadId = m.ThreadId ?? m.Id,
        InReplyTo = m.InReplyTo,
        Direction = m.Direction.ToString(),
        Subject = m.Subject,
        Body = m.Body,
        Read = m.Read,
        AdminRead = m.AdminRead,
        CreatedAt = m.Created,
    };
}
