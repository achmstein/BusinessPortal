using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.BusinessNames.Queries.GetBusinessNames;

public record GetBusinessNamesQuery : IRequest<IReadOnlyList<BusinessNameDto>>;

public class GetBusinessNamesQueryHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<GetBusinessNamesQuery, IReadOnlyList<BusinessNameDto>>
{
    public async Task<IReadOnlyList<BusinessNameDto>> Handle(
        GetBusinessNamesQuery request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var names = await context.BusinessNames
            .AsNoTracking()
            .Where(b => b.UserId == userId)
            .OrderBy(b => b.Name)
            .ToListAsync(cancellationToken);

        return names.Select(BusinessNameDto.FromEntity).ToList();
    }
}
