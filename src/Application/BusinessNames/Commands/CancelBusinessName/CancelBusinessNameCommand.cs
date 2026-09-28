using BusinessPortal.Application.Common.Exceptions;
using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.BusinessNames.Commands.CancelBusinessName;

/// <summary>Cancels (removes) a business name after the demo payment step. Ported
/// from the original processCancellation server action: optionally raises an ABN
/// cancellation support ticket. No automatic confirmation message is posted to
/// the client.</summary>
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

        // The data model doesn't hold the ABN→business-name link, so "name + ABN"
        // raises a support ticket for the team to action the ABN side manually.
        if (request.IncludeAbn)
        {
            var ticket = new Message
            {
                UserId = userId,
                Direction = MessageDirection.Outbound, // client -> support
                Subject = $"ABN cancellation request — {cancelledName}",
                Body =
                    $"I have just cancelled the business name \"{cancelledName}\" and would also like " +
                    "to cancel the associated ABN. Please action and confirm.",
                Read = true,       // the client wrote it
                AdminRead = false, // support hasn't seen it yet
            };
            ticket.ThreadId = ticket.Id;
            context.Messages.Add(ticket);
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
