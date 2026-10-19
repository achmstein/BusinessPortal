using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BusinessPortal.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBusinessEntityTrusteeName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TrusteeName",
                table: "BusinessEntities",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TrusteeName",
                table: "BusinessEntities");
        }
    }
}
