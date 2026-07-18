using BusinessPortal.Application.Common.Exceptions;
using BusinessPortal.Application.Common.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.BusinessNames.Commands.UpdateBusinessName;

public record UpdateBusinessNameCommand(
    Guid Id,
    string Name,
    string DateRegistered,
    string RenewalDate,
    string AsicKey) : IRequest;

public class UpdateBusinessNameCommandValidator : AbstractValidator<UpdateBusinessNameCommand>
{
    public UpdateBusinessNameCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.AsicKey).MaximumLength(40);
    }
}

public class UpdateBusinessNameCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<UpdateBusinessNameCommand>
{
    public async Task Handle(UpdateBusinessNameCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var name = await context.BusinessNames
            .FirstOrDefaultAsync(b => b.Id == request.Id && b.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(BusinessName), request.Id);

        name.Name = request.Name;
        name.DateRegistered = request.DateRegistered;
        name.RenewalDate = request.RenewalDate;
        name.AsicKey = request.AsicKey;

        await context.SaveChangesAsync(cancellationToken);
    }
}
