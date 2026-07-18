using System.Globalization;

namespace BusinessPortal.Domain.Services;

/// <summary>Pure, dependency-free ASIC renewal maths — ported from the original
/// lib/asic-helpers.ts (NOTIFY_WINDOW_DAYS + renewalUrgency). Trivially testable.</summary>
public static class AsicRenewalEvaluator
{
    /// <summary>Show renewals due within this many days (or already overdue).</summary>
    public const int NotifyWindowDays = 90;

    /// <summary>Whole days until the renewal date (negative if overdue), or null
    /// when the date is missing/unparseable.</summary>
    public static int? DaysUntil(string? renewalDate, DateOnly today)
    {
        if (string.IsNullOrWhiteSpace(renewalDate))
            return null;

        if (!DateOnly.TryParse(renewalDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var due))
            return null;

        return due.DayNumber - today.DayNumber;
    }

    /// <summary>Whether this renewal should be surfaced (overdue or within the window).</summary>
    public static bool IsWithinNotifyWindow(int daysUntil) => daysUntil <= NotifyWindowDays;

    /// <summary>Badge tone + label, matching renewalUrgency() in the original.</summary>
    public static (RenewalTone Tone, string Label) Urgency(int daysUntil)
    {
        if (daysUntil < 0)
            return (RenewalTone.Red, $"Overdue · {Math.Abs(daysUntil)}d");
        if (daysUntil <= 30)
            return (RenewalTone.Amber, $"Due in {daysUntil}d");
        return (RenewalTone.Gray, $"Due in {daysUntil}d");
    }
}
