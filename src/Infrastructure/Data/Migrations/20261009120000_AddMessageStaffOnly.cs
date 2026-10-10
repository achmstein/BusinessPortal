using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BusinessPortal.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageStaffOnly : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "StaffOnly",
                table: "Messages",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StaffOnly",
                table: "Messages");
        }
    }
}
