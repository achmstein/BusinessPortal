using BusinessPortal.Application.Common.Models;

namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>Gateway to the public ABN Lookup dataset (data.gov.au). Implemented in
/// Infrastructure as a typed HttpClient.</summary>
public interface IAbnLookupClient
{
    Task<IReadOnlyList<AbnRegisteredName>> LookupBusinessNamesByAbnAsync(string abn, CancellationToken cancellationToken);
}
