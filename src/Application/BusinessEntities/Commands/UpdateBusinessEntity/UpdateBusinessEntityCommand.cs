using BusinessPortal.Application.Common.Exceptions;
using BusinessPortal.Application.Common.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.BusinessEntities.Commands.UpdateBusinessEntity;

public record UpdateBusinessEntityCommand(
    Guid Id,
    string Name,
    EntityType EntityType,
    string Abn,
    string Acn,
    string Industry,
    int Employees,
    string Phone,
    string Website) : IRequest;

public class UpdateBusinessEntityCommandValidator : AbstractValidator<UpdateBusinessEntityCommand>
{
    public UpdateBusinessEntityCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Abn).MaximumLength(20);
        RuleFor(x => x.Acn).MaximumLength(20);
        RuleFor(x => x.Employees).GreaterThanOrEqualTo(0);
    }
}

public class UpdateBusinessEntityCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<UpdateBusinessEntityCommand>
{
    public async Task Handle(UpdateBusinessEntityCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var entity = await context.BusinessEntities
            .FirstOrDefaultAsync(e => e.Id == request.Id && e.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(BusinessEntity), request.Id);

        // Source and the ATO-only fields (TFN, tax accounts) are left as they are.
        entity.Name = request.Name;
        entity.EntityType = request.EntityType;
        entity.Abn = request.Abn;
        entity.Acn = request.Acn;
        entity.Industry = request.Industry;
        entity.Employees = request.Employees;
        entity.Phone = request.Phone;
        entity.Website = request.Website;

        await context.SaveChangesAsync(cancellationToken);
    }
}
