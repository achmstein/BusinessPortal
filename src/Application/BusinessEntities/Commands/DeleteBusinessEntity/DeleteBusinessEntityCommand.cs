using BusinessPortal.Application.Common.Exceptions;
using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.BusinessEntities.Commands.DeleteBusinessEntity;

public record DeleteBusinessEntityCommand(Guid Id) : IRequest;

public class DeleteBusinessEntityCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<DeleteBusinessEntityCommand>
{
    public async Task Handle(DeleteBusinessEntityCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var entity = await context.BusinessEntities
            .FirstOrDefaultAsync(e => e.Id == request.Id && e.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(BusinessEntity), request.Id);

        context.BusinessEntities.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}
