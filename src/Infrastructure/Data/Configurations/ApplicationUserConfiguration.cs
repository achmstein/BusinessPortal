using BusinessPortal.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(u => u.AtoNominatedFromAbn).HasMaxLength(20);

        // Personal details stored inline as columns on the users table.
        builder.OwnsOne(u => u.Profile, profile =>
        {
            profile.Property(p => p.FirstName).HasMaxLength(100);
            profile.Property(p => p.LastName).HasMaxLength(100);
            profile.Property(p => p.Phone).HasMaxLength(40);
            profile.Property(p => p.Dob).HasMaxLength(20);
            profile.Property(p => p.Tfn).HasMaxLength(20);
            profile.Property(p => p.Abn).HasMaxLength(20);
            profile.Property(p => p.Address).HasMaxLength(200);
            profile.Property(p => p.Suburb).HasMaxLength(100);
            profile.Property(p => p.State).HasMaxLength(50);
            profile.Property(p => p.Postcode).HasMaxLength(10);
        });

        // Client collections cascade-delete with the user.
        builder.HasMany(u => u.Entities)
            .WithOne()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(u => u.BusinessNames)
            .WithOne()
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany<BusinessNameRenewal>()
            .WithOne()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(u => u.Messages)
            .WithOne()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
