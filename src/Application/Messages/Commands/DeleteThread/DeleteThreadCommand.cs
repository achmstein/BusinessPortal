using BusinessPortal.Application.Common.Exceptions;
using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.Messages.Commands.DeleteThread;

/// <summary>Client deletes one of their conversations — every message in the thread.</summary>
public record DeleteThreadCommand(Guid ThreadId) : IRequest;

public class DeleteThreadCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<DeleteThreadCommand>
{
    public async Task Handle(DeleteThreadCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var messages = await context.Messages
            .Where(m => m.UserId == userId
                        && !m.StaffOnly
                        && (m.ThreadId == request.ThreadId || m.Id == request.ThreadId))
            .ToListAsync(cancellationToken);

        if (messages.Count == 0)
            throw new NotFoundException(nameof(Message), request.ThreadId);

        context.Messages.RemoveRange(messages);
        await context.SaveChangesAsync(cancellationToken);
    }
}
