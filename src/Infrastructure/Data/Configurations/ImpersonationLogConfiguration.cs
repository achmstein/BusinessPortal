using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class ImpersonationLogConfiguration : IEntityTypeConfiguration<ImpersonationLog>
{
    public void Configure(EntityTypeBuilder<ImpersonationLog> builder)
    {
        builder.Property(l => l.AdminUserId).IsRequired();
        builder.Property(l => l.TargetUserId).IsRequired();
        builder.Property(l => l.Reason).HasMaxLength(1000);
        builder.Property(l => l.IpAddress).HasMaxLength(64);
        builder.Property(l => l.UserAgent).HasMaxLength(512);

        builder.HasIndex(l => l.AdminUserId);
        builder.HasIndex(l => l.TargetUserId);
    }
}
