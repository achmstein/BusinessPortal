using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.Messages.Commands.MarkThreadRead;

/// <summary>Client opened a thread — mark its inbound (support→client) messages read.</summary>
public record MarkThreadReadCommand(Guid ThreadId) : IRequest;

public class MarkThreadReadCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<MarkThreadReadCommand>
{
    public async Task Handle(MarkThreadReadCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var unread = await context.Messages
            .Where(m => m.UserId == userId
                        && (m.ThreadId == request.ThreadId || m.Id == request.ThreadId)
                        && m.Direction == MessageDirection.Inbound
                        && !m.Read)
            .ToListAsync(cancellationToken);

        if (unread.Count == 0)
            return;

        foreach (var m in unread)
            m.Read = true;

        await context.SaveChangesAsync(cancellationToken);
    }
}
