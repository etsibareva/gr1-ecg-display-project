using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "doctors",
                columns: table => new
                {
                    IdDoctor = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FirstName = table.Column<string>(type: "text", nullable: false),
                    LastName = table.Column<string>(type: "text", nullable: false),
                    Patronym = table.Column<string>(type: "text", nullable: false),
                    Login = table.Column<string>(type: "text", nullable: false),
                    Password = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_doctors", x => x.IdDoctor);
                });

            migrationBuilder.CreateTable(
                name: "records",
                columns: table => new
                {
                    IdRecord = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IdDoctor = table.Column<int>(type: "integer", nullable: false),
                    RC = table.Column<int>(type: "integer", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    SignalFileSize = table.Column<long>(type: "bigint", nullable: false),
                    SignalObjectName = table.Column<string>(type: "text", nullable: false),
                    SignalOriginalFileName = table.Column<string>(type: "text", nullable: false),
                    SignalUploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_records", x => x.IdRecord);
                    table.ForeignKey(
                        name: "FK_records_doctors_IdDoctor",
                        column: x => x.IdDoctor,
                        principalTable: "doctors",
                        principalColumn: "IdDoctor",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "refreshTokens",
                columns: table => new
                {
                    IdRefreshToken = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IdDoctor = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "text", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refreshTokens", x => x.IdRefreshToken);
                    table.ForeignKey(
                        name: "FK_refreshTokens_doctors_IdDoctor",
                        column: x => x.IdDoctor,
                        principalTable: "doctors",
                        principalColumn: "IdDoctor",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "markups",
                columns: table => new
                {
                    IdMarkup = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MarkupObjectName = table.Column<string>(type: "text", nullable: true),
                    MarkupFileSize = table.Column<long>(type: "bigint", nullable: true),
                    MarkupOriginalFileName = table.Column<string>(type: "text", nullable: true),
                    MarkupUploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IdRecord = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_markups", x => x.IdMarkup);
                    table.ForeignKey(
                        name: "FK_markups_records_IdRecord",
                        column: x => x.IdRecord,
                        principalTable: "records",
                        principalColumn: "IdRecord",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_doctors_Email",
                table: "doctors",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_markups_IdRecord",
                table: "markups",
                column: "IdRecord");

            migrationBuilder.CreateIndex(
                name: "IX_records_IdDoctor",
                table: "records",
                column: "IdDoctor");

            migrationBuilder.CreateIndex(
                name: "IX_refreshTokens_IdDoctor",
                table: "refreshTokens",
                column: "IdDoctor");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "markups");

            migrationBuilder.DropTable(
                name: "refreshTokens");

            migrationBuilder.DropTable(
                name: "records");

            migrationBuilder.DropTable(
                name: "doctors");
        }
    }
}
