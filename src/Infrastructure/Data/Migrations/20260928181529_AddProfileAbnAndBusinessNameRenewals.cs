using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BusinessPortal.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProfileAbnAndBusinessNameRenewals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Profile_Abn",
                table: "AspNetUsers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "BusinessNameRenewals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    BusinessNameId = table.Column<Guid>(type: "uuid", nullable: true),
                    BusinessName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Years = table.Column<int>(type: "integer", nullable: false),
                    NewRenewalDate = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    RenewedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BusinessNameRenewals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BusinessNameRenewals_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BusinessNameRenewals_UserId",
                table: "BusinessNameRenewals",
                column: "UserId");

            // Backfill the history from the "renewal confirmed" messages the
            // Ontraport webhook and Renewtron sync used to post instead.
            migrationBuilder.Sql(@"
                INSERT INTO ""BusinessNameRenewals""
                    (""Id"", ""UserId"", ""BusinessNameId"", ""BusinessName"", ""Years"", ""NewRenewalDate"",
                     ""Source"", ""Reference"", ""RenewedAt"", ""Created"", ""LastModified"")
                SELECT gen_random_uuid(), m.""UserId"", bn.""Id"", left(m.name, 200),
                       coalesce(substring(m.""Body"" from 'renewed for (\d+) year')::int, 0),
                       coalesce(left(substring(m.""Body"" from 'New renewal date: ([0-9-]+)'), 20), ''),
                       'Imported', '', m.""Created"", m.""Created"", m.""Created""
                FROM (
                    SELECT *, substring(""Subject"" from 'Business name renewal confirmed — (.*)$') AS name
                    FROM ""Messages""
                    WHERE ""Subject"" LIKE 'Business name renewal confirmed — %'
                ) m
                LEFT JOIN LATERAL (
                    SELECT b.""Id"" FROM ""BusinessNames"" b
                    WHERE b.""UserId"" = m.""UserId"" AND lower(trim(b.""Name"")) = lower(trim(m.name))
                    LIMIT 1
                ) bn ON true;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BusinessNameRenewals");

            migrationBuilder.DropColumn(
                name: "Profile_Abn",
                table: "AspNetUsers");
        }
    }
}
