using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class RenewtronProvisionLogConfiguration : IEntityTypeConfiguration<RenewtronProvisionLog>
{
    public void Configure(EntityTypeBuilder<RenewtronProvisionLog> builder)
    {
        // One row per Renewtron renewal — the sync's idempotency key.
        builder.HasIndex(l => l.RenewalId).IsUnique();

        builder.Property(l => l.Email).HasMaxLength(320);
        builder.Property(l => l.BusinessName).HasMaxLength(200);
        builder.Property(l => l.Abn).HasMaxLength(20);
        builder.Property(l => l.Source).HasMaxLength(20);
        builder.Property(l => l.Detail).HasMaxLength(2000);
        builder.Property(l => l.UserId).HasMaxLength(450);

        builder.HasIndex(l => l.Outcome);
    }
}
