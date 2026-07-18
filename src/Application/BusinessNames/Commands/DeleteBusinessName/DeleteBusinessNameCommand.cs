using BusinessPortal.Application.Common.Exceptions;
using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.BusinessNames.Commands.DeleteBusinessName;

public record DeleteBusinessNameCommand(Guid Id) : IRequest;

public class DeleteBusinessNameCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<DeleteBusinessNameCommand>
{
    public async Task Handle(DeleteBusinessNameCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var name = await context.BusinessNames
            .FirstOrDefaultAsync(b => b.Id == request.Id && b.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(BusinessName), request.Id);

        context.BusinessNames.Remove(name);
        await context.SaveChangesAsync(cancellationToken);
    }
}
