using BusinessPortal.Domain.Enums;

namespace BusinessPortal.Application.Messages.Queries.GetMessageThreads;

/// <summary>A conversation. Ported from groupIntoThreads() in the original
/// lib/message-helpers.ts.</summary>
public record ThreadDto
{
    public Guid ThreadId { get; init; }
    public string Subject { get; init; } = string.Empty;
    public IReadOnlyList<MessageDto> Messages { get; init; } = [];
    public DateTimeOffset LastActivityAt { get; init; }
    public int UnreadForClient { get; init; }
    public int UnreadForAdmin { get; init; }

    /// <summary>Internal to staff — the client never sees this conversation.</summary>
    public bool StaffOnly { get; init; }

    /// <summary>Group a flat message list into threads: messages sorted oldest→newest
    /// within a thread, threads sorted by most-recent-activity first.</summary>
    public static IReadOnlyList<ThreadDto> GroupIntoThreads(IEnumerable<Message> all)
    {
        var buckets = new Dictionary<Guid, List<Message>>();
        foreach (var m in all)
        {
            var tid = m.ThreadId ?? m.Id; // threadIdOf
            if (!buckets.TryGetValue(tid, out var list))
                buckets[tid] = list = [];
            list.Add(m);
        }

        var threads = new List<ThreadDto>();
        foreach (var (threadId, messages) in buckets)
        {
            messages.Sort((a, b) => a.Created.CompareTo(b.Created));
            var root = messages[0];
            var last = messages[^1];
            threads.Add(new ThreadDto
            {
                ThreadId = threadId,
                Subject = root.Subject,
                Messages = messages.Select(MessageDto.FromEntity).ToList(),
                LastActivityAt = last.Created,
                UnreadForClient = messages.Count(m => m.Direction == MessageDirection.Inbound && !m.Read),
                UnreadForAdmin = messages.Count(m => m.Direction == MessageDirection.Outbound && !m.AdminRead),
                StaffOnly = root.StaffOnly,
            });
        }

        return threads.OrderByDescending(t => t.LastActivityAt).ToList();
    }
}
