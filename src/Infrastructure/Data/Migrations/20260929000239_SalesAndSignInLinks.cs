using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BusinessPortal.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class SalesAndSignInLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "RenewtronSaleId",
                table: "BusinessNameRenewals",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SignInLinkRedemptions",
                columns: table => new
                {
                    Jti = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    RedeemedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignInLinkRedemptions", x => x.Jti);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BusinessNameRenewals_RenewtronSaleId",
                table: "BusinessNameRenewals",
                column: "RenewtronSaleId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SignInLinkRedemptions");

            migrationBuilder.DropIndex(
                name: "IX_BusinessNameRenewals_RenewtronSaleId",
                table: "BusinessNameRenewals");

            migrationBuilder.DropColumn(
                name: "RenewtronSaleId",
                table: "BusinessNameRenewals");
        }
    }
}
