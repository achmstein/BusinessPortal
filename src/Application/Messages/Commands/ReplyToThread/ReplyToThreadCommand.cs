using BusinessPortal.Application.Common.Exceptions;
using BusinessPortal.Application.Common.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.Messages.Commands.ReplyToThread;

/// <summary>Client adds a reply to an existing conversation (outbound).</summary>
public record ReplyToThreadCommand(Guid ThreadId, string Body) : IRequest;

public class ReplyToThreadCommandValidator : AbstractValidator<ReplyToThreadCommand>
{
    public ReplyToThreadCommandValidator()
        => RuleFor(x => x.Body).NotEmpty().MaximumLength(8000);
}

public class ReplyToThreadCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<ReplyToThreadCommand>
{
    public async Task Handle(ReplyToThreadCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        // Root subject — messages whose ThreadId matches, or the legacy root itself.
        var root = await context.Messages
            .AsNoTracking()
            .Where(m => m.UserId == userId && (m.ThreadId == request.ThreadId || m.Id == request.ThreadId))
            .OrderBy(m => m.Created)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Thread", request.ThreadId);

        var reply = new Message
        {
            UserId = userId,
            ThreadId = request.ThreadId,
            Direction = MessageDirection.Outbound,
            Subject = root.Subject,
            Body = request.Body,
            Read = true,
            AdminRead = false,
        };

        context.Messages.Add(reply);
        await context.SaveChangesAsync(cancellationToken);
    }
}
