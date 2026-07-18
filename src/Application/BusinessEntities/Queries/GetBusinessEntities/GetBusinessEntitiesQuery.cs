using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.BusinessEntities.Queries.GetBusinessEntities;

/// <summary>Every business entity owned by the current user, newest first.</summary>
public record GetBusinessEntitiesQuery : IRequest<IReadOnlyList<BusinessEntityDto>>;

public class GetBusinessEntitiesQueryHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<GetBusinessEntitiesQuery, IReadOnlyList<BusinessEntityDto>>
{
    public async Task<IReadOnlyList<BusinessEntityDto>> Handle(
        GetBusinessEntitiesQuery request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var entities = await context.BusinessEntities
            .AsNoTracking()
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.Created)
            .ToListAsync(cancellationToken);

        return entities.Select(BusinessEntityDto.FromEntity).ToList();
    }
}
