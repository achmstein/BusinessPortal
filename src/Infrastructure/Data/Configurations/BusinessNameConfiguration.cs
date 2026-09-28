using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class BusinessNameConfiguration : IEntityTypeConfiguration<BusinessName>
{
    public void Configure(EntityTypeBuilder<BusinessName> builder)
    {
        builder.Property(b => b.UserId).IsRequired();
        builder.Property(b => b.Name).HasMaxLength(200);
        builder.Property(b => b.DateRegistered).HasMaxLength(20);
        builder.Property(b => b.RenewalDate).HasMaxLength(20);
        builder.Property(b => b.AsicKey).HasMaxLength(40);

        // Npgsql maps List<string> to a native text[] column.
        builder.Property(b => b.RenewalTransactionIds);

        builder.Property(b => b.AsicKeyRequestStatus).HasMaxLength(20);
        builder.Property(b => b.PendingAsicKey).HasMaxLength(40);

        builder.HasIndex(b => b.UserId);
    }
}
