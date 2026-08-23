namespace BusinessPortal.Domain.Enums;

/// <summary>What the Renewtron sync did for one completed renewal.</summary>
public enum ProvisionOutcome
{
    /// <summary>A new portal account was created (and a set-password invite sent).</summary>
    Created = 0,

    /// <summary>The customer already had an account; profile/business data refreshed.</summary>
    Updated = 1,

    /// <summary>Nothing to provision (e.g. the renewal has no email — bulk uploads).</summary>
    Skipped = 2,

    /// <summary>Processing threw; retried on later runs up to the attempt cap.</summary>
    Failed = 3,
}
