using BusinessPortal.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class AtoSessionConfiguration : IEntityTypeConfiguration<AtoSession>
{
    public void Configure(EntityTypeBuilder<AtoSession> builder)
    {
        builder.Property(s => s.UserId).IsRequired();
        builder.Property(s => s.Email).HasMaxLength(320);
        builder.HasIndex(s => new { s.UserId, s.Email }).IsUnique();
        builder.HasIndex(s => s.UserId);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class AtoLinkAttemptConfiguration : IEntityTypeConfiguration<AtoLinkAttempt>
{
    public void Configure(EntityTypeBuilder<AtoLinkAttempt> builder)
    {
        builder.Property(a => a.UserId).IsRequired();
        builder.Property(a => a.ReferenceCode).HasMaxLength(10);
        builder.HasIndex(a => a.UserId);
        builder.HasOne<ApplicationUser>().WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
