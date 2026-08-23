using BusinessPortal.Domain.Services;
using NUnit.Framework;

namespace BusinessPortal.Domain.UnitTests;

public class RenewalDateMathTests
{
    [Test]
    public void Extend_FromFutureDate_AddsYearsToThatDate()
    {
        var future = DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(3);
        var result = RenewalDateMath.Extend(future.ToString("yyyy-MM-dd"), 1);
        Assert.That(result, Is.EqualTo(future.AddYears(1).ToString("yyyy-MM-dd")));
    }

    [TestCase("")]
    [TestCase("not-a-date")]
    [TestCase("2020-01-01")] // lapsed — renews forward from today, not the overdue date
    public void Extend_FromBlankInvalidOrPastDate_AddsYearsToToday(string existing)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var result = RenewalDateMath.Extend(existing, 3);
        Assert.That(result, Is.EqualTo(today.AddYears(3).ToString("yyyy-MM-dd")));
    }
}
