using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BusinessPortal.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGeneratedPasswordHash : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GeneratedPasswordHash",
                table: "AspNetUsers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GeneratedPasswordHash",
                table: "AspNetUsers");
        }
    }
}
