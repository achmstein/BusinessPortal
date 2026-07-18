namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>The current request's user id (or null when unauthenticated).
/// Implemented in the Web layer from the HttpContext; consumed by the auditing
/// interceptor and use-cases that need "who am I".</summary>
public interface IUser
{
    string? Id { get; }
}
