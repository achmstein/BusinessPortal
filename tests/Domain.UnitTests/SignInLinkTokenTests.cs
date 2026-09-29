using BusinessPortal.Domain.Services;
using NUnit.Framework;

namespace BusinessPortal.Domain.UnitTests;

public class SignInLinkTokenTests
{
    private static readonly string Key = new('k', 40);
    private static readonly DateTimeOffset Now = new(2026, 09, 29, 0, 0, 0, TimeSpan.Zero);
    private static readonly Guid Jti = Guid.Parse("00000000000000000000000000000001");

    [Test]
    public void RoundTrips_AndNormalisesEmail()
    {
        var token = SignInLinkToken.Create(" Alice@Test.com ", Key, Now.AddHours(72), Jti);

        var result = SignInLinkToken.TryRead(token, Key, Now, out var claims);

        Assert.That(result, Is.EqualTo(SignInLinkToken.Failure.None));
        Assert.That(claims!.Email, Is.EqualTo("alice@test.com"));
        Assert.That(claims.Jti, Is.EqualTo(Jti.ToString("N")));
        Assert.That(claims.Expires, Is.EqualTo(Now.AddHours(72)));
    }

    /// <summary>The shared test vector. Renewtron's PortalLinks.CreateSignInToken must
    /// produce this exact string for the same inputs, or its links won't sign in.</summary>
    [Test]
    public void MatchesTheWireFormatRenewtronUses()
    {
        var token = SignInLinkToken.Create("alice@test.com", Key, Now.AddHours(72), Jti);

        Assert.That(token, Is.EqualTo(
            "eyJlbWFpbCI6ImFsaWNlQHRlc3QuY29tIiwiZXhwIjoxNzkwODk5MjAwLCJqdGkiOiIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMSJ9" +
            ".dkG28NM6LgGdZvK5LTOBfinJnwpgdTyr2m9mRcUMc-0"));
    }

    [Test]
    public void RejectsExpired()
    {
        var token = SignInLinkToken.Create("alice@test.com", Key, Now.AddHours(72), Jti);
        Assert.That(SignInLinkToken.TryRead(token, Key, Now.AddHours(72), out _), Is.EqualTo(SignInLinkToken.Failure.Expired));
    }

    [Test]
    public void RejectsWrongKey()
    {
        var token = SignInLinkToken.Create("alice@test.com", Key, Now.AddHours(72), Jti);
        Assert.That(SignInLinkToken.TryRead(token, new string('x', 40), Now, out _),
            Is.EqualTo(SignInLinkToken.Failure.BadSignature));
    }

    [Test]
    public void RejectsTamperedPayload()
    {
        var token = SignInLinkToken.Create("alice@test.com", Key, Now.AddHours(72), Jti);
        var other = SignInLinkToken.Create("mallory@test.com", Key, Now.AddHours(72), Jti);
        // Mallory's payload with Alice's signature.
        var forged = other.Split('.')[0] + "." + token.Split('.')[1];
        Assert.That(SignInLinkToken.TryRead(forged, Key, Now, out _), Is.EqualTo(SignInLinkToken.Failure.BadSignature));
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("no-dot")]
    [TestCase("a.b.c")]
    [TestCase(".sig")]
    public void RejectsMalformed(string? token)
    {
        Assert.That(SignInLinkToken.TryRead(token, Key, Now, out _), Is.Not.EqualTo(SignInLinkToken.Failure.None));
    }
}
