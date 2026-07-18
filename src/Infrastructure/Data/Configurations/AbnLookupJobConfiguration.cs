using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class AbnLookupJobConfiguration : IEntityTypeConfiguration<AbnLookupJob>
{
    public void Configure(EntityTypeBuilder<AbnLookupJob> builder)
    {
        builder.Property(j => j.UserId).IsRequired();
        builder.Property(j => j.Error).HasMaxLength(2000);
        builder.HasIndex(j => j.UserId);
    }
}
