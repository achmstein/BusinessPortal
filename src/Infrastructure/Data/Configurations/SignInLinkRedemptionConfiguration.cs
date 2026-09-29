using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class SignInLinkRedemptionConfiguration : IEntityTypeConfiguration<SignInLinkRedemption>
{
    public void Configure(EntityTypeBuilder<SignInLinkRedemption> builder)
    {
        builder.HasKey(r => r.Jti);
        builder.Property(r => r.Jti).HasMaxLength(64);
        builder.Property(r => r.UserId).HasMaxLength(450);
    }
}
