using BusinessPortal.Application.Common.Interfaces;
using FluentValidation;
using MediatR;

namespace BusinessPortal.Application.BusinessEntities.Commands.CreateBusinessEntity;

public record CreateBusinessEntityCommand(
    string Name,
    EntityType EntityType,
    string Abn,
    string Acn,
    string Industry,
    int Employees,
    string Phone,
    string Website,
    string? TrusteeName = null) : IRequest<Guid>;

public class CreateBusinessEntityCommandValidator : AbstractValidator<CreateBusinessEntityCommand>
{
    public CreateBusinessEntityCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Abn).MaximumLength(20);
        RuleFor(x => x.Acn).MaximumLength(20);
        RuleFor(x => x.Employees).GreaterThanOrEqualTo(0);
        RuleFor(x => x.TrusteeName).MaximumLength(200);
    }
}

public class CreateBusinessEntityCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<CreateBusinessEntityCommand, Guid>
{
    public async Task<Guid> Handle(CreateBusinessEntityCommand request, CancellationToken cancellationToken)
    {
        var entity = new BusinessEntity
        {
            UserId = user.Id ?? throw new InvalidOperationException("No current user."),
            Name = request.Name,
            EntityType = request.EntityType,
            Abn = request.Abn,
            Acn = request.Acn,
            Industry = request.Industry,
            Employees = request.Employees,
            Phone = request.Phone,
            Website = request.Website,
            TrusteeName = request.EntityType == EntityType.Trust ? request.TrusteeName?.Trim() ?? string.Empty : string.Empty,
            Source = EntitySource.Manual,
        };

        context.BusinessEntities.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}
