using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class BusinessNameRenewalConfiguration : IEntityTypeConfiguration<BusinessNameRenewal>
{
    public void Configure(EntityTypeBuilder<BusinessNameRenewal> builder)
    {
        builder.Property(r => r.UserId).IsRequired();
        builder.Property(r => r.BusinessName).HasMaxLength(200);
        builder.Property(r => r.NewRenewalDate).HasMaxLength(20);
        builder.Property(r => r.Source).HasMaxLength(20);
        builder.Property(r => r.Reference).HasMaxLength(100);

        builder.Property(r => r.Abn).HasMaxLength(20);
        builder.Property(r => r.Status).HasMaxLength(20);
        builder.Property(r => r.StatusMessage).HasMaxLength(500);
        builder.Property(r => r.TransactionReference).HasMaxLength(100);

        builder.HasIndex(r => r.UserId);
        // One portal row per Renewtron renewal — the sync's upsert key.
        builder.HasIndex(r => r.RenewtronRenewalId).IsUnique();
        builder.HasIndex(r => r.RenewtronSaleId).IsUnique();
    }
}
