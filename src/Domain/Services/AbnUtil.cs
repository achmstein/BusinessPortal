using System.Text.RegularExpressions;

namespace BusinessPortal.Domain.Services;

/// <summary>Pure ABN helpers — ported from lib/abn-lookup.ts (normaliseAbn / formatAbn).</summary>
public static partial class AbnUtil
{
    /// <summary>Strip everything but digits.</summary>
    public static string NormaliseAbn(string? abn) => NonDigits().Replace(abn ?? string.Empty, string.Empty);

    /// <summary>True when the value is a well-formed 11-digit ABN.</summary>
    public static bool IsValidAbn(string? abn) => NormaliseAbn(abn).Length == 11;

    /// <summary>Canonical ABN formatting: "XX XXX XXX XXX" (returns the input unchanged
    /// if it isn't 11 digits).</summary>
    public static string FormatAbn(string? abn)
    {
        var a = NormaliseAbn(abn);
        if (a.Length != 11) return abn ?? string.Empty;
        return $"{a[..2]} {a.Substring(2, 3)} {a.Substring(5, 3)} {a.Substring(8, 3)}";
    }

    [GeneratedRegex("[^0-9]")]
    private static partial Regex NonDigits();
}
