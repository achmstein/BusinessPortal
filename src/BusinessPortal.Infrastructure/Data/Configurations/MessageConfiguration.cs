using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BusinessPortal.Infrastructure.Data.Configurations;

public class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> builder)
    {
        builder.Property(m => m.UserId).IsRequired();
        builder.Property(m => m.Subject).HasMaxLength(300);
        builder.Property(m => m.Body).HasMaxLength(8000);

        builder.HasIndex(m => m.UserId);
        builder.HasIndex(m => m.ThreadId);
    }
}
