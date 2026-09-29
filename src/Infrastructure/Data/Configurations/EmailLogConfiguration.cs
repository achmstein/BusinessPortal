using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class EmailLogConfiguration : IEntityTypeConfiguration<EmailLog>
{
    public void Configure(EntityTypeBuilder<EmailLog> builder)
    {
        builder.Property(e => e.UserId).HasMaxLength(450);
        builder.Property(e => e.To).HasMaxLength(320);
        builder.Property(e => e.Kind).HasMaxLength(20);
        builder.Property(e => e.Status).HasMaxLength(20);
        builder.Property(e => e.Error).HasMaxLength(500);

        builder.HasIndex(e => new { e.UserId, e.Kind });
        builder.HasIndex(e => e.At);
    }
}
