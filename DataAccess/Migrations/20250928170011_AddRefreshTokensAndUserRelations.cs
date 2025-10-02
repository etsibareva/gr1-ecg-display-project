using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokensAndUserRelations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Id",
                table: "doctors",
                newName: "IdDoctor");

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

            migrationBuilder.CreateIndex(
                name: "IX_doctors_Email",
                table: "doctors",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refreshTokens_IdDoctor",
                table: "refreshTokens",
                column: "IdDoctor");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "refreshTokens");

            migrationBuilder.DropIndex(
                name: "IX_doctors_Email",
                table: "doctors");

            migrationBuilder.RenameColumn(
                name: "IdDoctor",
                table: "doctors",
                newName: "Id");
        }
    }
}
