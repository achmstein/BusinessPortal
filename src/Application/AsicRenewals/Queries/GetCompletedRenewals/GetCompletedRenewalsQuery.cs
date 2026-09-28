using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.AsicRenewals.Queries.GetCompletedRenewals;

public record CompletedRenewalDto
{
    public Guid Id { get; init; }
    public Guid? BusinessNameId { get; init; }
    public string BusinessName { get; init; } = string.Empty;
    public int Years { get; init; }
    public string NewRenewalDate { get; init; } = string.Empty;
    public DateTimeOffset RenewedAt { get; init; }
    public string Status { get; init; } = "Completed";
    public string? StatusMessage { get; init; }
    public string? TransactionReference { get; init; }
}

/// <summary>Business-name renewals the current user has paid for, in progress and
/// completed, newest first.</summary>
public record GetCompletedRenewalsQuery : IRequest<IReadOnlyList<CompletedRenewalDto>>;

public class GetCompletedRenewalsQueryHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<GetCompletedRenewalsQuery, IReadOnlyList<CompletedRenewalDto>>
{
    public async Task<IReadOnlyList<CompletedRenewalDto>> Handle(
        GetCompletedRenewalsQuery request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        return await context.BusinessNameRenewals
            .AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.RenewedAt)
            .Select(r => new CompletedRenewalDto
            {
                Id = r.Id,
                BusinessNameId = r.BusinessNameId,
                BusinessName = r.BusinessName,
                Years = r.Years,
                NewRenewalDate = r.NewRenewalDate,
                RenewedAt = r.RenewedAt,
                Status = r.Status,
                StatusMessage = r.StatusMessage,
                TransactionReference = r.TransactionReference,
            })
            .ToListAsync(cancellationToken);
    }
}
