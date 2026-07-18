using FluentValidation.Results;

namespace BusinessPortal.Application.Common.Exceptions;

/// <summary>Thrown by the validation pipeline behaviour; turned into a 400
/// ValidationProblemDetails by the Web layer's CustomExceptionHandler.</summary>
public class ValidationException : Exception
{
    public ValidationException()
        : base("One or more validation failures have occurred.")
        => Errors = new Dictionary<string, string[]>();

    public ValidationException(IEnumerable<ValidationFailure> failures) : this()
        => Errors = failures
            .GroupBy(e => e.PropertyName, e => e.ErrorMessage)
            .ToDictionary(g => g.Key, g => g.ToArray());

    public IDictionary<string, string[]> Errors { get; }
}
