using System.Security.Claims;
using BusinessPortal.Application.Common.Interfaces;

namespace BusinessPortal.Web.Services;

/// <summary>Resolves the current user's id from the auth cookie's claims.</summary>
public class CurrentUser(IHttpContextAccessor accessor) : IUser
{
    public string? Id => accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
}
