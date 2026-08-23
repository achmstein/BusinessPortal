using System.Globalization;

namespace BusinessPortal.Domain.Services;

/// <summary>Renewal-date arithmetic shared by the Ontraport renewal-paid webhook
/// and the Renewtron sync. Dates are the portal's yyyy-MM-dd strings.</summary>
public static class RenewalDateMath
{
    /// <summary>Extend a renewal date by <paramref name="years"/>: from the existing
    /// date when it's still in the future, else from today (a lapsed name renews
    /// forward from now, not from its overdue date).</summary>
    public static string Extend(string existing, int years)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var baseDate = today;
        if (DateOnly.TryParse(existing, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) && d > today)
            baseDate = d;
        return baseDate.AddYears(years).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }
}
