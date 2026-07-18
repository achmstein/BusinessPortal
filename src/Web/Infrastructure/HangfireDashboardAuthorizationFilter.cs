using Hangfire.Dashboard;

namespace BusinessPortal.Web.Infrastructure;

/// <summary>Restricts the Hangfire dashboard to signed-in admins.</summary>
public class HangfireDashboardAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();
        return http.User.Identity?.IsAuthenticated == true && http.User.IsInRole("Admin");
    }
}
