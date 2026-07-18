using System.Globalization;
using BusinessPortal.Application.Common.Exceptions;
using BusinessPortal.Application.Common.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.AsicRenewals.Commands.RenewBusinessName;

/// <summary>Extend a business name's renewal date by N years. Mirrors the
/// renewal-paid webhook: extend from the existing date if still in the future,
/// otherwise from today.</summary>
public record RenewBusinessNameCommand(Guid Id, int Years) : IRequest<string>;

public class RenewBusinessNameCommandValidator : AbstractValidator<RenewBusinessNameCommand>
{
    public RenewBusinessNameCommandValidator()
        => RuleFor(x => x.Years).InclusiveBetween(1, 3);
}

public class RenewBusinessNameCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<RenewBusinessNameCommand, string>
{
    public async Task<string> Handle(RenewBusinessNameCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var name = await context.BusinessNames
            .FirstOrDefaultAsync(b => b.Id == request.Id && b.UserId == userId, cancellationToken)
            ?? throw new NotFoundException("BusinessName", request.Id);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var baseDate = today;
        if (DateOnly.TryParse(name.RenewalDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var current)
            && current > today)
        {
            baseDate = current;
        }

        var newDate = baseDate.AddYears(request.Years);
        name.RenewalDate = newDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        await context.SaveChangesAsync(cancellationToken);
        return name.RenewalDate;
    }
}
