using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddMarkupAndRecordTablesWithJsonbcorrected1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "markups",
                columns: table => new
                {
                    IdMarkup = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    JsonData = table.Column<string>(type: "jsonb", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_markups", x => x.IdMarkup);
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
                    IdSignal = table.Column<int>(type: "integer", nullable: false),
                    IdMarkup = table.Column<int>(type: "integer", nullable: false)
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
                    table.ForeignKey(
                        name: "FK_records_markups_IdMarkup",
                        column: x => x.IdMarkup,
                        principalTable: "markups",
                        principalColumn: "IdMarkup",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_markups_JsonData",
                table: "markups",
                column: "JsonData")
                .Annotation("Npgsql:IndexMethod", "GIN");

            migrationBuilder.CreateIndex(
                name: "IX_records_IdDoctor",
                table: "records",
                column: "IdDoctor");

            migrationBuilder.CreateIndex(
                name: "IX_records_IdMarkup",
                table: "records",
                column: "IdMarkup");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "records");

            migrationBuilder.DropTable(
                name: "markups");
        }
    }
}
