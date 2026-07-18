using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Domain.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.AsicRenewals.Queries.GetAsicRenewals;

/// <summary>Outstanding ASIC renewals for the current user — business names due
/// within the notify window (or overdue), newest-due first. Ported from
/// outstandingAsicRenewals() (business-name branch).</summary>
public record GetAsicRenewalsQuery : IRequest<IReadOnlyList<AsicRenewalDto>>;

public class GetAsicRenewalsQueryHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<GetAsicRenewalsQuery, IReadOnlyList<AsicRenewalDto>>
{
    public async Task<IReadOnlyList<AsicRenewalDto>> Handle(
        GetAsicRenewalsQuery request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var names = await context.BusinessNames
            .AsNoTracking()
            .Where(b => b.UserId == userId)
            .ToListAsync(cancellationToken);

        var renewals = new List<AsicRenewalDto>();
        foreach (var b in names)
        {
            var days = AsicRenewalEvaluator.DaysUntil(b.RenewalDate, today);
            if (days is null || !AsicRenewalEvaluator.IsWithinNotifyWindow(days.Value))
                continue;

            var (tone, label) = AsicRenewalEvaluator.Urgency(days.Value);
            renewals.Add(new AsicRenewalDto
            {
                SourceId = b.Id,
                Kind = "Business Name",
                Name = b.Name,
                Identifier = string.IsNullOrWhiteSpace(b.AsicKey) ? "—" : $"ASIC key {b.AsicKey}",
                DueDate = b.RenewalDate,
                DaysUntil = days.Value,
                Tone = tone.ToString(),
                Label = label,
            });
        }

        return renewals.OrderBy(r => r.DaysUntil).ToList();
    }
}
