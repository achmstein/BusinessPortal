using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.Messages.Queries.GetMessageThreads;

public record GetMessageThreadsQuery : IRequest<IReadOnlyList<ThreadDto>>;

public class GetMessageThreadsQueryHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<GetMessageThreadsQuery, IReadOnlyList<ThreadDto>>
{
    public async Task<IReadOnlyList<ThreadDto>> Handle(
        GetMessageThreadsQuery request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var messages = await context.Messages
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .ToListAsync(cancellationToken);

        return ThreadDto.GroupIntoThreads(messages);
    }
}
