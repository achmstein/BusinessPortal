using BusinessPortal.Application.Common.Exceptions;
using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.BusinessNames.Commands.CancelBusinessName;

/// <summary>Cancels (removes) a business name after the demo payment step. Ported
/// from the original processCancellation server action: optionally raises an ABN
/// cancellation support ticket, then posts an inbound confirmation — both in one
/// new thread.</summary>
public record CancelBusinessNameCommand(Guid Id, bool IncludeAbn) : IRequest;

public class CancelBusinessNameCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<CancelBusinessNameCommand>
{
    public async Task Handle(CancelBusinessNameCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var name = await context.BusinessNames
            .FirstOrDefaultAsync(b => b.Id == request.Id && b.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(BusinessName), request.Id);

        var cancelledName = name.Name;
        context.BusinessNames.Remove(name);

        // The ticket (if any) and the confirmation share a single fresh thread,
        // matching the original's one newId() for both.
        var threadId = Guid.NewGuid();

        // The data model doesn't hold the ABN→business-name link, so "name + ABN"
        // raises a support ticket for the team to action the ABN side manually.
        if (request.IncludeAbn)
        {
            context.Messages.Add(new Message
            {
                UserId = userId,
                ThreadId = threadId,
                Direction = MessageDirection.Outbound, // client -> support
                Subject = $"ABN cancellation request — {cancelledName}",
                Body =
                    $"I have just cancelled the business name \"{cancelledName}\" and would also like " +
                    "to cancel the associated ABN. Please action and confirm.",
                Read = true,       // the client wrote it
                AdminRead = false, // support hasn't seen it yet
            });
        }

        context.Messages.Add(new Message
        {
            UserId = userId,
            ThreadId = threadId,
            Direction = MessageDirection.Inbound, // support -> client
            Subject = $"Business name cancellation confirmed — {cancelledName}",
            Body = $"Your business name \"{cancelledName}\" is being cancelled.",
            Read = false,
            AdminRead = true,
        });

        await context.SaveChangesAsync(cancellationToken);
    }
}
