using BusinessPortal.Domain.Enums;
using BusinessPortal.Domain.Services;
using NUnit.Framework;

namespace BusinessPortal.Domain.UnitTests;

public class AsicRenewalEvaluatorTests
{
    private static readonly DateOnly Today = new(2026, 07, 18);

    [Test]
    public void DaysUntil_ReturnsNull_ForBlankOrInvalid()
    {
        Assert.That(AsicRenewalEvaluator.DaysUntil("", Today), Is.Null);
        Assert.That(AsicRenewalEvaluator.DaysUntil(null, Today), Is.Null);
        Assert.That(AsicRenewalEvaluator.DaysUntil("not-a-date", Today), Is.Null);
    }

    [TestCase("2026-07-18", 0)]
    [TestCase("2026-07-28", 10)]
    [TestCase("2026-07-08", -10)]
    public void DaysUntil_CountsWholeDays(string date, int expected)
    {
        Assert.That(AsicRenewalEvaluator.DaysUntil(date, Today), Is.EqualTo(expected));
    }

    [TestCase(-3, RenewalTone.Red)]
    [TestCase(0, RenewalTone.Amber)]
    [TestCase(30, RenewalTone.Amber)]
    [TestCase(31, RenewalTone.Gray)]
    public void Urgency_TonesMatchOriginal(int daysUntil, RenewalTone expectedTone)
    {
        Assert.That(AsicRenewalEvaluator.Urgency(daysUntil).Tone, Is.EqualTo(expectedTone));
    }
}
