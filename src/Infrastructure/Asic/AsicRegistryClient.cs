using System.Text;
using System.Text.RegularExpressions;
using AngleSharp.Html.Dom;
using AngleSharp.Html.Parser;
using BusinessPortal.Application.Common.Interfaces;
using BusinessPortal.Application.Common.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BusinessPortal.Infrastructure.Asic;

/// <summary>Scrapes the ASIC Connect business-names register (Oracle ADF UI) for the real
/// registration/renewal dates behind an ABN. Ported from Asictron's AsicRegistryClient —
/// the ADF session-state bootstrap, the invisible-reCAPTCHA gate, the Rich-Message
/// partial-page-update POSTs and result-list pagination are all load-bearing; the
/// URL-encoded ADF bodies, the newline-sensitive bootstrap regexes, and Adf-Page-Id=0
/// (captcha) vs =1 (navigation) are copied verbatim. Holds its own cookie jar + ADF window
/// state, so it's resolved per job (not shared). UNVERIFIED — needs 2Captcha credit.</summary>
public sealed partial class AsicRegistryClient : IAsicRegistryClient, IDisposable
{
    private const string BaseUrl = "https://connectonline.asic.gov.au/";
    private const string UserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0";

    private readonly HttpClient _http;
    private readonly AsicCaptchaSolver _captcha;
    private readonly ILogger<AsicRegistryClient> _logger;
    private readonly HtmlParser _htmlParser = new();

    private string? _adfWindowId;
    private string? _viewState;

    public AsicRegistryClient(AsicCaptchaSolver captcha, IConfiguration config, ILogger<AsicRegistryClient> logger)
    {
        _captcha = captcha;
        _logger = logger;

        var timeout = int.TryParse(config["Asic:TimeoutSeconds"], out var t) && t > 0 ? t : 180;
        var handler = new SocketsHttpHandler
        {
            UseCookies = true,
            CookieContainer = new System.Net.CookieContainer(),
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            PooledConnectionLifetime = TimeSpan.FromMinutes(2),
        };
        _http = new HttpClient(handler)
        {
            BaseAddress = new Uri(BaseUrl),
            Timeout = TimeSpan.FromSeconds(timeout),
        };
        _http.DefaultRequestHeaders.TryAddWithoutValidation("User-Agent", UserAgent);
    }

    public bool IsConfigured => _captcha.IsConfigured;

    public async Task<IReadOnlyList<AsicBusinessName>> SearchByAbnAsync(string abn, CancellationToken cancellationToken)
    {
        var content = await GetSearchContentAsync(abn, cancellationToken);
        if (content is null) return [];

        var document = _htmlParser.ParseDocument(content);
        var results = new List<AsicBusinessName>();

        if (content.Contains("Business names search results"))
        {
            // Multi-result list → click each row, parse its detail, page through.
            var hasMorePages = true;
            while (hasMorePages && !cancellationToken.IsCancellationRequested)
            {
                var searchRegionIndex = GetRegionIndex(document);
                var resultCount = document.QuerySelectorAll("a[id*='bnConnectionTemplate:r1:']")
                    .Count(x => x.GetAttribute("id")?.Contains("orgName") ?? false);

                for (var resultIndex = 0; resultIndex < resultCount; resultIndex++)
                {
                    var id = $"bnConnectionTemplate:r1:{searchRegionIndex}:t1:{resultIndex}";
                    document = await PostRichMessageAsync(OpenDetailBody(id, searchRegionIndex), cancellationToken);
                    var detailRegionIndex = GetRegionIndex(document);
                    var parsed = AsicParser.ParseFromDocument(document);
                    if (parsed is not null) results.Add(parsed);
                    if (resultIndex != resultCount - 1)
                        document = await PostRichMessageAsync(BackToResultsBody(detailRegionIndex), cancellationToken);
                }

                var detailRegion = GetRegionIndex(document);
                var nextEnabled = document.QuerySelector("a[id*='next']")?.GetAttribute("class")?.Contains("p_AFDisabled") == false;
                if (nextEnabled)
                {
                    document = await PostRichMessageAsync(BackToResultsBody(detailRegion), cancellationToken);
                    var currentRegion = GetRegionIndex(document);
                    document = await PostRichMessageAsync(NextPageBody(currentRegion), cancellationToken);
                }
                else
                {
                    hasMorePages = false;
                }
            }
        }
        else
        {
            // Single summary page — parse the detail table directly.
            var parsed = AsicParser.ParseFromDocument(document);
            if (parsed is not null) results.Add(parsed);
        }

        return results;
    }

    /// <summary>The two-phase ADF bootstrap GET, then the captcha gate. Returns the final
    /// search HTML (post-captcha if one was presented). Sets <see cref="_adfWindowId"/> /
    /// <see cref="_viewState"/> from the hidden inputs.</summary>
    private async Task<string?> GetSearchContentAsync(string abn, CancellationToken ct)
    {
        var url = $"RegistrySearch/faces/landing/panelSearch.jspx?searchType=Bn&searchName=&searchNumber={abn}";
        var content = await _http.GetStringAsync(url, ct);

        var afrLoop = AfrLoopRegex().Match(content).Groups["AfrLoop"].Value;
        var afrPage = AfrPageRegex().Match(content).Groups["AfrPage"].Value;

        content = await _http.GetStringAsync(
            $"RegistrySearch/faces/landing/panelSearch.jspx?searchType=Bn&searchName=&searchNumber={abn}" +
            $"&_afrLoop={afrLoop}&_afrWindowMode=2&Adf-Window-Id={afrPage}&_afrFS=16&_afrMT=screen&_afrMFW=1865" +
            "&_afrMFH=924&_afrMFDW=1920&_afrMFDH=1080&_afrMFC=8&_afrMFCI=0&_afrMFM=0&_afrMFR=96&_afrMFG=0&_afrMFS=0&_afrMFO=0",
            ct);

        var document = _htmlParser.ParseDocument(content);

        // Captcha is presented when neither results marker is in the HTML.
        if (!content.Contains("Business names search results") && !content.Contains("Business Name Summary"))
        {
            _adfWindowId = document.QuerySelector("input[name='Adf-Window-Id']")?.GetAttribute("value");
            _viewState = document.QuerySelector("input[name='javax.faces.ViewState']")?.GetAttribute("value");

            if (!_captcha.IsConfigured) throw new TwoCaptchaNotConfigured();

            var solved = await SolveCaptchaAsync(_adfWindowId, _viewState, ct);
            if (string.IsNullOrEmpty(solved)) throw new CaptchaSolveFailed("ASIC captcha could not be solved");

            content = solved;
            document = _htmlParser.ParseDocument(content);
        }

        _adfWindowId = document.QuerySelector("input[name='Adf-Window-Id']")?.GetAttribute("value") ?? _adfWindowId;
        _viewState = document.QuerySelector("input[name='javax.faces.ViewState']")?.GetAttribute("value") ?? _viewState;
        return content;
    }

    /// <summary>Solve the invisible reCAPTCHA and replay the token to ASIC's search button.
    /// Returns the resulting search HTML.</summary>
    private async Task<string?> SolveCaptchaAsync(string? adfWindowId, string? viewState, CancellationToken ct)
    {
        try
        {
            var url = $"{BaseUrl}RegistrySearch/faces/landing/panelSearch.jspx?Adf-Window-Id={adfWindowId}&Adf-Page-Id=0";
            var token = await _captcha.SolveInvisibleRecaptchaAsync(url, ct);

            var body =
                "bnConnectionTemplate:pt_s5:templateSearchTypesListOfValuesId=6&bnConnectionTemplate:pt_s5:searchSurname=" +
                "&bnConnectionTemplate:pt_s5:searchFirstName=&bnConnectionTemplate:pt_s5:templateSearchInputText=" +
                "&bnConnectionTemplate:pt_s5:searchName=Name&bnConnectionTemplate:pt_s5:searchNumber=Number" +
                $"&g-recaptcha-response={token}" +
                "&bnConnectionTemplate:r1:0:searchPanelLanding:dc1:s1:searchTypesLovId=0" +
                "&bnConnectionTemplate:r1:0:searchPanelLanding:dc1:s1:searchSurname=" +
                "&bnConnectionTemplate:r1:0:searchPanelLanding:dc1:s1:searchFirstName=" +
                "&bnConnectionTemplate:r1:0:searchPanelLanding:dc1:s1:searchForTextId=Name+or+Number" +
                "&org.apache.myfaces.trinidad.faces.FORM=f1" +
                $"&Adf-Window-Id={adfWindowId}&Adf-Page-Id=0&javax.faces.ViewState={viewState}" +
                "&event=bnConnectionTemplate%3Ar1%3A0%3AsearchButtonCap" +
                "&event.bnConnectionTemplate:r1:0:searchButtonCap=%3Cm+xmlns%3D%22http%3A%2F%2Foracle.com%2FrichClient%2Fcomm%22%3E%3Ck+v%3D%22type%22%3E%3Cs%3Eaction%3C%2Fs%3E%3C%2Fk%3E%3C%2Fm%3E" +
                "&oracle.adf.view.rich.PROCESS=bnConnectionTemplate%3Ar1%2CbnConnectionTemplate%3Ar1%3A0%3AsearchButtonCap";

            using var resp = await _http.PostAsync(url, new StringContent(body, Encoding.UTF8, "application/x-www-form-urlencoded"), ct);
            return await resp.Content.ReadAsStringAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ASIC captcha submission failed");
            return null;
        }
    }

    private async Task<IHtmlDocument> PostRichMessageAsync(string body, CancellationToken ct)
    {
        var url = $"RegistrySearch/faces/landing/panelSearch.jspx?Adf-Window-Id={_adfWindowId}&Adf-Page-Id=1";
        using var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/x-www-form-urlencoded"),
        };
        req.Headers.TryAddWithoutValidation("Adf-Rich-Message", "true");
        using var resp = await _http.SendAsync(req, ct);
        var xml = await resp.Content.ReadAsStringAsync(ct);
        return ParseRichMessageResponse(xml);
    }

    /// <summary>Extract the fresh ViewState + the bnConnectionTemplate:r1 HTML fragment from
    /// the ADF Rich-Message XML envelope.</summary>
    private IHtmlDocument ParseRichMessageResponse(string xml)
    {
        var vs = ViewStateUpdateRegex().Match(xml);
        if (vs.Success) _viewState = vs.Groups[1].Value;

        var html = HtmlUpdateRegex().Match(xml);
        return _htmlParser.ParseDocument(html.Success ? html.Groups[1].Value : xml);
    }

    private int GetRegionIndex(AngleSharp.Dom.IParentNode document)
    {
        var id = document.QuerySelector("[id^='bnConnectionTemplate:r1:']")?.GetAttribute("id");
        if (id is not null)
        {
            var m = RegionIndexRegex().Match(id);
            if (m.Success && int.TryParse(m.Groups[1].Value, out var index)) return index;
        }
        return 0;
    }

    // ─── ADF partial-page-update bodies (verbatim, already URL-encoded) ───

    private string OpenDetailBody(string id, int regionIndex) =>
        "bnConnectionTemplate:pt_s5:templateSearchTypesListOfValuesId=6&bnConnectionTemplate:pt_s5:searchSurname=" +
        "&bnConnectionTemplate:pt_s5:searchFirstName=&bnConnectionTemplate:pt_s5:templateSearchInputText=" +
        "&bnConnectionTemplate:pt_s5:searchName=Name&bnConnectionTemplate:pt_s5:searchNumber=Number" +
        $"&bnConnectionTemplate:r1:{regionIndex}:totalItemsSelected=0" +
        $"&bnConnectionTemplate:r1:{regionIndex}:generalSearchPanelFragment:s4:searchTypesLovId=1" +
        $"&bnConnectionTemplate:r1:{regionIndex}:generalSearchPanelFragment:s4:searchSurname=" +
        $"&bnConnectionTemplate:r1:{regionIndex}:generalSearchPanelFragment:s4:searchFirstName=" +
        $"&bnConnectionTemplate:r1:{regionIndex}:generalSearchPanelFragment:s4:searchForTextId=" +
        $"&bnConnectionTemplate:r1:{regionIndex}:generalSearchPanelFragment:s4:searchForName=" +
        $"&bnConnectionTemplate:r1:{regionIndex}:generalSearchPanelFragment:s4:searchForNumber=" +
        $"&bnConnectionTemplate:r1:{regionIndex}:fetchsize=0&bnConnectionTemplate:r1:{regionIndex}:fetchsizetwin=0" +
        "&org.apache.myfaces.trinidad.faces.FORM=f1" +
        $"&Adf-Window-Id={_adfWindowId}&javax.faces.ViewState={_viewState}&Adf-Page-Id=1" +
        "&oracle.adf.view.rich.RENDER=bnConnectionTemplate%3Ar1" +
        $"&oracle.adf.view.rich.DELTAS=%7BbnConnectionTemplate%3Ar1%3A{regionIndex}%3At1%3D%7Brows%3D10%7D%7D" +
        $"&event={id}%3AorgName" +
        $"&event.{id}:orgName=%3Cm+xmlns%3D%22http%3A%2F%2Foracle.com%2FrichClient%2Fcomm%22%3E%3Ck+v%3D%22type%22%3E%3Cs%3Eaction%3C%2Fs%3E%3C%2Fk%3E%3C%2Fm%3E" +
        $"&oracle.adf.view.rich.PROCESS=bnConnectionTemplate%3Ar1%2C{id}%3AorgName";

    private string BackToResultsBody(int regionIndex) =>
        "bnConnectionTemplate:pt_s5:templateSearchTypesListOfValuesId=6&bnConnectionTemplate:pt_s5:searchSurname=" +
        "&bnConnectionTemplate:pt_s5:searchFirstName=&bnConnectionTemplate:pt_s5:templateSearchInputText=" +
        "&bnConnectionTemplate:pt_s5:searchName=Name&bnConnectionTemplate:pt_s5:searchNumber=Number" +
        "&org.apache.myfaces.trinidad.faces.FORM=f1" +
        $"&Adf-Window-Id={_adfWindowId}&javax.faces.ViewState={_viewState}&Adf-Page-Id=1" +
        "&oracle.adf.view.rich.RENDER=bnConnectionTemplate%3Ar1" +
        $"&oracle.adf.view.rich.DELTAS=%7BbnConnectionTemplate%3Ar1%3A{regionIndex}%3At1%3D%7Brows%3D10%7D%7D" +
        $"&event=bnConnectionTemplate%3Ar1%3A{regionIndex}%3Acb7" +
        $"&event.bnConnectionTemplate:r1:{regionIndex}:cb7=%3Cm+xmlns%3D%22http%3A%2F%2Foracle.com%2FrichClient%2Fcomm%22%3E%3Ck+v%3D%22type%22%3E%3Cs%3Eaction%3C%2Fs%3E%3C%2Fk%3E%3C%2Fm%3E" +
        $"&oracle.adf.view.rich.PROCESS=bnConnectionTemplate%3Ar1%2CbnConnectionTemplate%3Ar1%3A{regionIndex}%3Acb7";

    private string NextPageBody(int regionIndex) =>
        "bnConnectionTemplate:pt_s5:templateSearchTypesListOfValuesId=6&bnConnectionTemplate:pt_s5:searchSurname=" +
        "&bnConnectionTemplate:pt_s5:searchFirstName=&bnConnectionTemplate:pt_s5:templateSearchInputText=" +
        "&bnConnectionTemplate:pt_s5:searchName=Name&bnConnectionTemplate:pt_s5:searchNumber=Number" +
        "&org.apache.myfaces.trinidad.faces.FORM=f1" +
        $"&Adf-Window-Id={_adfWindowId}&javax.faces.ViewState={_viewState}&Adf-Page-Id=1" +
        "&oracle.adf.view.rich.RENDER=bnConnectionTemplate%3Ar1" +
        $"&oracle.adf.view.rich.DELTAS=%7BbnConnectionTemplate%3Ar1%3A{regionIndex}%3At1%3D%7Brows%3D10%7D%7D" +
        $"&event=bnConnectionTemplate%3Ar1%3A{regionIndex}%3At1%3Anext" +
        $"&event.bnConnectionTemplate:r1:{regionIndex}:t1:next=%3Cm+xmlns%3D%22http%3A%2F%2Foracle.com%2FrichClient%2Fcomm%22%3E%3Ck+v%3D%22type%22%3E%3Cs%3Eaction%3C%2Fs%3E%3C%2Fk%3E%3C%2Fm%3E" +
        $"&oracle.adf.view.rich.PROCESS=bnConnectionTemplate%3Ar1%2CbnConnectionTemplate%3Ar1%3A{regionIndex}%3At1%3Anext";

    public void Dispose() => _http.Dispose();

    // The bootstrap regexes are newline-sensitive — the JS literally renders `',\n '`.
    [GeneratedRegex(@"_afrLoop',\n '(?<AfrLoop>\d+)'")]
    private static partial Regex AfrLoopRegex();

    [GeneratedRegex(@"_afrPage',\n '',\n '(?<AfrPage>\w+)'")]
    private static partial Regex AfrPageRegex();

    [GeneratedRegex(@"<update id=""javax\.faces\.ViewState""><!\[CDATA\[(.+?)\]\]></update>")]
    private static partial Regex ViewStateUpdateRegex();

    [GeneratedRegex(@"<update id=""bnConnectionTemplate:r1""><!\[CDATA\[(.+?)\]\]></update>", RegexOptions.Singleline)]
    private static partial Regex HtmlUpdateRegex();

    [GeneratedRegex(@"bnConnectionTemplate:r1:(\d+)")]
    private static partial Regex RegionIndexRegex();
}
