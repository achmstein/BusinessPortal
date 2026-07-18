using BusinessPortal.Application.Common.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace BusinessPortal.Web.Infrastructure;

/// <summary>Maps Application exceptions to ProblemDetails responses. Validation →
/// 400 with field errors, NotFound → 404. Everything else falls through to the
/// default ProblemDetails handler.</summary>
public class CustomExceptionHandler : IExceptionHandler
{
    private readonly Dictionary<Type, Func<HttpContext, Exception, Task>> _handlers;

    public CustomExceptionHandler()
    {
        _handlers = new Dictionary<Type, Func<HttpContext, Exception, Task>>
        {
            { typeof(ValidationException), HandleValidationException },
            { typeof(NotFoundException), HandleNotFoundException },
        };
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (_handlers.TryGetValue(exception.GetType(), out var handler))
        {
            await handler(httpContext, exception);
            return true;
        }

        return false;
    }

    private static async Task HandleValidationException(HttpContext ctx, Exception ex)
    {
        var exception = (ValidationException)ex;
        ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
        await ctx.Response.WriteAsJsonAsync(new ValidationProblemDetails(exception.Errors)
        {
            Status = StatusCodes.Status400BadRequest,
        });
    }

    private static async Task HandleNotFoundException(HttpContext ctx, Exception ex)
    {
        ctx.Response.StatusCode = StatusCodes.Status404NotFound;
        await ctx.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Title = "The specified resource was not found.",
            Detail = ex.Message,
        });
    }
}
