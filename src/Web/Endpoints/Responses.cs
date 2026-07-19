namespace BusinessPortal.Web.Endpoints;

// Named response shapes so the OpenAPI schema (and the generated TS client) is
// typed rather than anonymous.
public record IdResponse(Guid Id);
public record MeResponse(string Id, string? Email, bool IsAdmin, bool AtoConnected, string FirstName, string LastName, bool Impersonating);
public record JobStartedResponse(Guid JobId);
public record ThreadStartedResponse(Guid ThreadId);
public record RenewalResponse(string RenewalDate);
public record AdminOverviewResponse(int Clients, int ActiveThreads, int UnreadMessages, int RenewalsDue);
