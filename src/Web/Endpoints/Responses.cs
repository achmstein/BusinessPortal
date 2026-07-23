using BusinessPortal.Application.Messages.Queries.GetMessageThreads;

namespace BusinessPortal.Web.Endpoints;

// Named response shapes so the OpenAPI schema (and the generated TS client) is
// typed rather than anonymous.
public record IdResponse(Guid Id);
public record ErrorResponse(string Error);
public record MeResponse(string Id, string? Email, bool IsAdmin, bool AtoConnected, string FirstName, string LastName, bool Impersonating);
public record JobStartedResponse(Guid JobId);
public record ThreadStartedResponse(Guid ThreadId);
public record RenewalResponse(string RenewalDate);
public record AdminOverviewResponse(int Clients, int ActiveThreads, int UnreadMessages, int RenewalsDue);

// ─── Admin registry (cross-client flatten of names/entities/companies) ───
public record RegistryClientRef(string Id, string Name, string? Email);
public record RegistryBusinessNameRow(Guid Id, string Name, string AsicKey, string DateRegistered, string RenewalDate, RegistryClientRef Client);
public record RegistryEntityRow(Guid Id, string Name, string EntityType, string Abn, string Acn, string Industry, RegistryClientRef Client);
public record RegistryCompanyRow(string Name, string Acn, string Abn, string Source, RegistryClientRef Client);
public record AdminRegistryResponse(
    int Clients,
    IReadOnlyList<RegistryBusinessNameRow> BusinessNames,
    IReadOnlyList<RegistryEntityRow> Entities,
    IReadOnlyList<RegistryCompanyRow> Companies);

// ─── Admin per-client conversation view ───
public record AdminClientThreadsResponse(string Id, string? Email, string? Name, IReadOnlyList<ThreadDto> Threads);
