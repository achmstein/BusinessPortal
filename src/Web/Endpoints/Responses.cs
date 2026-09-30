using BusinessPortal.Application.Messages.Queries.GetMessageThreads;

namespace BusinessPortal.Web.Endpoints;

// Named response shapes so the OpenAPI schema (and the generated TS client) is
// typed rather than anonymous.
public record IdResponse(Guid Id);
public record ErrorResponse(string Error);
public record MeResponse(string Id, string? Email, bool IsAdmin, bool AtoConnected, string FirstName, string LastName, bool Impersonating, bool NeedsPassword);
public record JobStartedResponse(Guid JobId);
public record ThreadStartedResponse(Guid ThreadId);
public record RenewalResponse(string RenewalDate);
public record AdminOverviewResponse(
    int Clients, int ActiveThreads, int UnreadMessages, int RenewalsDue,
    int EmailFailures24h, string? LastEmailError, int WelcomePending);

public record EmailLogRow(string Kind, string Status, string? Error, DateTimeOffset At);
public record ResendWelcomeResponse(string Status);
public record ResendPendingResponse(int Attempted, int Sent, string? StoppedBecause);

// ─── Admin registry (cross-client flatten of names/entities/companies) ───
public record RegistryClientRef(string Id, string Name, string? Email);
public record RegistryBusinessNameRow(Guid Id, string Name, string AsicKey, string DateRegistered, string RenewalDate, RegistryClientRef Client);
public record RegistryEntityRow(Guid Id, string Name, string EntityType, string Abn, string Acn, string Industry, RegistryClientRef Client);
public record RegistryCompanyRow(string Name, string Acn, string Abn, string Source, RegistryClientRef Client);
// Counts for the registry's tab labels — three cheap COUNTs rather than
// materialising every row just to length them.
public record RegistrySummaryResponse(int Clients, int BusinessNames, int Entities, int Companies);

// One page of registry rows. Concrete records per row type rather than a generic
// Page<T>, so the OpenAPI schema (and the generated client) stays specific.
public record RegistryBusinessNamesPage(int TotalCount, int Page, int PageSize, IReadOnlyList<RegistryBusinessNameRow> Items);
public record RegistryEntitiesPage(int TotalCount, int Page, int PageSize, IReadOnlyList<RegistryEntityRow> Items);
public record RegistryCompaniesPage(int TotalCount, int Page, int PageSize, IReadOnlyList<RegistryCompanyRow> Items);

// ─── Admin clients list ───
public record AdminClientRow(string Id, string? Email, string FirstName, string LastName, bool AtoConnected, DateTimeOffset CreatedAt);
public record AdminClientsPage(int TotalCount, int Page, int PageSize, IReadOnlyList<AdminClientRow> Items);

// ─── Admin per-client conversation view ───
public record AdminClientThreadsResponse(string Id, string? Email, string? Name, IReadOnlyList<ThreadDto> Threads);
