using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddNpySignalStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdSignal",
                table: "records");

            migrationBuilder.AddColumn<long>(
                name: "SignalFileSize",
                table: "records",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "SignalObjectName",
                table: "records",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SignalOriginalFileName",
                table: "records",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "SignalUploadedAt",
                table: "records",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SignalFileSize",
                table: "records");

            migrationBuilder.DropColumn(
                name: "SignalObjectName",
                table: "records");

            migrationBuilder.DropColumn(
                name: "SignalOriginalFileName",
                table: "records");

            migrationBuilder.DropColumn(
                name: "SignalUploadedAt",
                table: "records");

            migrationBuilder.AddColumn<int>(
                name: "IdSignal",
                table: "records",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
