using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BusinessPortal.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenewtronPartnerIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AsicKeyRequestId",
                table: "BusinessNames",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AsicKeyRequestStatus",
                table: "BusinessNames",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AsicKeyRequestedAt",
                table: "BusinessNames",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PendingAsicKey",
                table: "BusinessNames",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Abn",
                table: "BusinessNameRenewals",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "RenewtronRenewalId",
                table: "BusinessNameRenewals",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "BusinessNameRenewals",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Completed");

            migrationBuilder.AddColumn<string>(
                name: "StatusMessage",
                table: "BusinessNameRenewals",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TransactionReference",
                table: "BusinessNameRenewals",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            // Rows the old completed-only sync wrote kept the Renewtron id in Reference.
            migrationBuilder.Sql(@"
                UPDATE ""BusinessNameRenewals""
                SET ""RenewtronRenewalId"" = ""Reference""::uuid
                WHERE ""Source"" = 'Renewtron'
                  AND ""Reference"" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';");

            migrationBuilder.CreateIndex(
                name: "IX_BusinessNameRenewals_RenewtronRenewalId",
                table: "BusinessNameRenewals",
                column: "RenewtronRenewalId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BusinessNameRenewals_RenewtronRenewalId",
                table: "BusinessNameRenewals");

            migrationBuilder.DropColumn(
                name: "AsicKeyRequestId",
                table: "BusinessNames");

            migrationBuilder.DropColumn(
                name: "AsicKeyRequestStatus",
                table: "BusinessNames");

            migrationBuilder.DropColumn(
                name: "AsicKeyRequestedAt",
                table: "BusinessNames");

            migrationBuilder.DropColumn(
                name: "PendingAsicKey",
                table: "BusinessNames");

            migrationBuilder.DropColumn(
                name: "Abn",
                table: "BusinessNameRenewals");

            migrationBuilder.DropColumn(
                name: "RenewtronRenewalId",
                table: "BusinessNameRenewals");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "BusinessNameRenewals");

            migrationBuilder.DropColumn(
                name: "StatusMessage",
                table: "BusinessNameRenewals");

            migrationBuilder.DropColumn(
                name: "TransactionReference",
                table: "BusinessNameRenewals");
        }
    }
}
