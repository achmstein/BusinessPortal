using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BusinessPortal.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAtoSessionAndLinkAttempt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AtoLinkAttempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    StateEncrypted = table.Column<string>(type: "text", nullable: false),
                    ReferenceCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AtoLinkAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AtoLinkAttempts_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AtoSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    CookiesEncrypted = table.Column<string>(type: "text", nullable: false),
                    AgentsJson = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AtoSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AtoSessions_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AtoLinkAttempts_UserId",
                table: "AtoLinkAttempts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AtoSessions_UserId",
                table: "AtoSessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AtoSessions_UserId_Email",
                table: "AtoSessions",
                columns: new[] { "UserId", "Email" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AtoLinkAttempts");

            migrationBuilder.DropTable(
                name: "AtoSessions");
        }
    }
}
