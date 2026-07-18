using System.Linq.Expressions;
using BusinessPortal.Application.Common.Interfaces;
using Hangfire;

namespace BusinessPortal.Infrastructure.Jobs;

/// <summary>IJobScheduler over Hangfire. The enqueued expression is resolved from
/// DI on a worker when it runs.</summary>
public class HangfireJobScheduler(IBackgroundJobClient client) : IJobScheduler
{
    public void Enqueue<TService>(Expression<Func<TService, Task>> methodCall) => client.Enqueue(methodCall);
}
