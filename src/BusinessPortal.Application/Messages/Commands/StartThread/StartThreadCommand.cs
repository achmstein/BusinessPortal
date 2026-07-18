using BusinessPortal.Application.Common.Interfaces;
using FluentValidation;
using MediatR;

namespace BusinessPortal.Application.Messages.Commands.StartThread;

/// <summary>Client starts a new conversation with support (outbound message).</summary>
public record StartThreadCommand(string Subject, string Body) : IRequest<Guid>;

public class StartThreadCommandValidator : AbstractValidator<StartThreadCommand>
{
    public StartThreadCommandValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Body).NotEmpty().MaximumLength(8000);
    }
}

public class StartThreadCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<StartThreadCommand, Guid>
{
    public async Task<Guid> Handle(StartThreadCommand request, CancellationToken cancellationToken)
    {
        var message = new Message
        {
            UserId = user.Id ?? throw new InvalidOperationException("No current user."),
            Direction = MessageDirection.Outbound, // client -> support
            Subject = request.Subject,
            Body = request.Body,
            Read = true,       // the client wrote it
            AdminRead = false,  // support hasn't seen it yet
        };
        message.ThreadId = message.Id; // root of a new thread

        context.Messages.Add(message);
        await context.SaveChangesAsync(cancellationToken);
        return message.ThreadId.Value;
    }
}
