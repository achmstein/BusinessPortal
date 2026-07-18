using BusinessPortal.Application.Common.Interfaces;
using FluentValidation;
using MediatR;

namespace BusinessPortal.Application.BusinessNames.Commands.CreateBusinessName;

public record CreateBusinessNameCommand(
    string Name,
    string DateRegistered,
    string RenewalDate,
    string AsicKey) : IRequest<Guid>;

public class CreateBusinessNameCommandValidator : AbstractValidator<CreateBusinessNameCommand>
{
    public CreateBusinessNameCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AsicKey).MaximumLength(40);
    }
}

public class CreateBusinessNameCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<CreateBusinessNameCommand, Guid>
{
    public async Task<Guid> Handle(CreateBusinessNameCommand request, CancellationToken cancellationToken)
    {
        var name = new BusinessName
        {
            UserId = user.Id ?? throw new InvalidOperationException("No current user."),
            Name = request.Name,
            DateRegistered = request.DateRegistered,
            RenewalDate = request.RenewalDate,
            AsicKey = request.AsicKey,
        };

        context.BusinessNames.Add(name);
        await context.SaveChangesAsync(cancellationToken);
        return name.Id;
    }
}
