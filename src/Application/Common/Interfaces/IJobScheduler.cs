using System.Linq.Expressions;

namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>Enqueues fire-and-forget background work. Implemented over Hangfire in
/// Infrastructure so the Application layer stays framework-agnostic (Asictron pattern).</summary>
public interface IJobScheduler
{
    void Enqueue<TService>(Expression<Func<TService, Task>> methodCall);
}
