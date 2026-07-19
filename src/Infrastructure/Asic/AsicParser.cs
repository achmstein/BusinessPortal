using System.Text.RegularExpressions;
using AngleSharp.Dom;
using AngleSharp.Html.Parser;
using BusinessPortal.Application.Common.Models;

namespace BusinessPortal.Infrastructure.Asic;

/// <summary>Extracts business-name detail from the ASIC Connect detail HTML. Label-based
/// (matches "Business name:", "Renewal date:", …) rather than positional — the DOM shuffles
/// between requests but the labels don't. C# port of lib/asic-connect/parse.ts, which
/// mirrors Asictron's GetBusinessNameFromElement.</summary>
public static partial class AsicParser
{
    private const string DetailTableSelector = ".detailTable[id*='bnConnectionTemplate:r1']";

    /// <summary>Parse a single business-name detail table (from raw HTML) into an
    /// <see cref="AsicBusinessName"/> (dates normalised to yyyy-MM-dd). Null if no detail
    /// table is present in the fragment.</summary>
    public static AsicBusinessName? ParseBusinessName(string html) =>
        ParseTable(new HtmlParser().ParseDocument(html).QuerySelector(DetailTableSelector));

    /// <summary>Parse the detail table found in an already-parsed document.</summary>
    public static AsicBusinessName? ParseFromDocument(IDocument doc) =>
        ParseTable(doc.QuerySelector(DetailTableSelector));

    private static AsicBusinessName? ParseTable(IElement? table)
    {
        if (table is null) return null;

        string ByLabel(string label)
        {
            var th = table.QuerySelectorAll("th").FirstOrDefault(e => e.TextContent.Trim().Contains(label));
            return th?.NextElementSibling?.TextContent.Trim() ?? string.Empty;
        }

        // Holders block — "Holder(s) details:" heading, then <span>s labelled "Holder Name:".
        var holders = new List<string>();
        var holdersHeader = table.QuerySelectorAll("th").FirstOrDefault(e => e.TextContent.Trim().Contains("Holder(s) details:"));
        var holdersContainer = holdersHeader?.NextElementSibling;
        if (holdersContainer is not null)
        {
            foreach (var span in holdersContainer.QuerySelectorAll("span"))
            {
                if (span.TextContent.Trim().Contains("Holder Name:"))
                {
                    var name = span.NextElementSibling?.TextContent.Trim();
                    if (!string.IsNullOrEmpty(name)) holders.Add(name);
                }
            }
        }

        return new AsicBusinessName
        {
            Name = ByLabel("Business name:"),
            Status = ByLabel("Status:"),
            DateRegistered = NormaliseAsicDate(ByLabel("Registration date:")),
            RenewalDate = NormaliseAsicDate(ByLabel("Renewal date:")),
            Holders = holders,
        };
    }

    /// <summary>Normalise ASIC's <c>dd/MM/yyyy</c> date strings to <c>yyyy-MM-dd</c>.
    /// Returns empty when the input isn't in the expected format.</summary>
    public static string NormaliseAsicDate(string raw)
    {
        var m = AsicDateRegex().Match(raw.Trim());
        if (!m.Success) return string.Empty;
        return $"{m.Groups[3].Value}-{m.Groups[2].Value.PadLeft(2, '0')}-{m.Groups[1].Value.PadLeft(2, '0')}";
    }

    [GeneratedRegex(@"^(\d{1,2})/(\d{1,2})/(\d{4})$")]
    private static partial Regex AsicDateRegex();
}
