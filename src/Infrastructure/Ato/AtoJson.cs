using System.Text.Json;

namespace BusinessPortal.Infrastructure.Ato;

/// <summary>Loose JSON readers for ATO REST responses. The same field can come back as a
/// string in one Application-Details mode and a number in another, so every read tolerates
/// both. Shared by the businesses/nominate ports.</summary>
internal static class AtoJson
{
    public static bool TryProp(JsonElement el, string name, out JsonElement child)
    {
        if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(name, out child)) return true;
        child = default;
        return false;
    }

    /// <summary>The <c>response</c> envelope member, or an empty object if absent.</summary>
    public static JsonElement Response(JsonElement root) =>
        TryProp(root, "response", out var r) ? r : default;

    /// <summary>Read a property as a string whether it's a JSON string or number.</summary>
    public static string? StringLoose(JsonElement el, string prop) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var v)
            ? Scalar(v)
            : null;

    /// <summary>Coerce a scalar element (string/number) to its string form.</summary>
    public static string? Scalar(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.String => v.GetString(),
        JsonValueKind.Number => v.GetRawText(),
        _ => null,
    };

    /// <summary>Read a property as an int whether it's a JSON number or numeric string.</summary>
    public static int? IntLoose(JsonElement el, string prop)
    {
        if (el.ValueKind != JsonValueKind.Object || !el.TryGetProperty(prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n)) return n;
        if (v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out var m)) return m;
        return null;
    }

    /// <summary>Enumerate an array-valued property (empty if missing/not an array).</summary>
    public static IEnumerable<JsonElement> ArrayProp(JsonElement el, string prop)
    {
        if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var arr) && arr.ValueKind == JsonValueKind.Array)
            foreach (var item in arr.EnumerateArray())
                yield return item;
    }
}
