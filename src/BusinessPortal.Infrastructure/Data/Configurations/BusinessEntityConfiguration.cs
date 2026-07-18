using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class BusinessEntityConfiguration : IEntityTypeConfiguration<BusinessEntity>
{
    public void Configure(EntityTypeBuilder<BusinessEntity> builder)
    {
        builder.Property(e => e.UserId).IsRequired();
        builder.Property(e => e.Name).HasMaxLength(200);
        builder.Property(e => e.Abn).HasMaxLength(20);
        builder.Property(e => e.Acn).HasMaxLength(20);
        builder.Property(e => e.Industry).HasMaxLength(120);
        builder.Property(e => e.Phone).HasMaxLength(40);
        builder.Property(e => e.Website).HasMaxLength(200);
        builder.Property(e => e.LegalName).HasMaxLength(200);
        builder.Property(e => e.Tfn).HasMaxLength(20);
        builder.Property(e => e.ClientAccountId).HasMaxLength(40);

        builder.HasIndex(e => e.UserId);
        builder.HasIndex(e => e.Abn);
    }
}
