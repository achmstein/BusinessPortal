using BusinessPortal.Application.Common.Models;

namespace BusinessPortal.Application.Common.Interfaces;

/// <summary>Scrapes the public ASIC Connect business-names register for the real
/// registration/renewal dates behind an ABN. Requires a 2Captcha key (an invisible
/// reCAPTCHA gates the search) — <see cref="IsConfigured"/> is false when unset, and
/// callers skip enrichment gracefully. Implemented in Infrastructure (ported from
/// Asictron). Each call costs ~$0.003 of 2Captcha credit and takes 30–90s.</summary>
public interface IAsicRegistryClient
{
    /// <summary>True iff a 2Captcha API key is configured; when false, <see cref="SearchByAbnAsync"/>
    /// throws and callers should skip ASIC enrichment.</summary>
    bool IsConfigured { get; }

    /// <summary>Every business name registered to the ABN, with real ASIC dates.</summary>
    Task<IReadOnlyList<AsicBusinessName>> SearchByAbnAsync(string abn, CancellationToken cancellationToken);
}
