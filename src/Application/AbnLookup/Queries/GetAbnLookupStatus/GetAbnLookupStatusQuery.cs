using BusinessPortal.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace BusinessPortal.Application.AbnLookup.Queries.GetAbnLookupStatus;

public record AbnLookupJobDto
{
    public string Status { get; init; } = string.Empty;
    public int TotalAbns { get; init; }
    public int AbnsProcessed { get; init; }
    public int AddedCount { get; init; }
    public int EnrichedCount { get; init; }
    public string? Error { get; init; }
    public DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }

    public static AbnLookupJobDto FromEntity(AbnLookupJob j) => new()
    {
        Status = j.Status.ToString(),
        TotalAbns = j.TotalAbns,
        AbnsProcessed = j.AbnsProcessed,
        AddedCount = j.AddedCount,
        EnrichedCount = j.EnrichedCount,
        Error = j.Error,
        StartedAt = j.StartedAt,
        CompletedAt = j.CompletedAt,
    };
}

/// <summary>Current ABN Lookup job status for the user (null if none). The UI polls
/// this to show progress.</summary>
public record GetAbnLookupStatusQuery : IRequest<AbnLookupJobDto?>;

public class GetAbnLookupStatusQueryHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<GetAbnLookupStatusQuery, AbnLookupJobDto?>
{
    public async Task<AbnLookupJobDto?> Handle(GetAbnLookupStatusQuery request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var job = await context.AbnLookupJobs
            .AsNoTracking()
            .Where(j => j.UserId == userId)
            .OrderByDescending(j => j.StartedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return job is null ? null : AbnLookupJobDto.FromEntity(job);
    }
}
