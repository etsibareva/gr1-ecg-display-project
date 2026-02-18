using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class UpdateModelsForMarkupWithMinIo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "IdRecord",
                table: "markups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            /*migrationBuilder.AddColumn<string>(
                name: "MarkupObjectName",
                table: "markups",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "MarkupFileSize",
                table: "markups",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "MarkupOriginalFileName",
                table: "markups",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "MarkupUploadedAt",
                table: "markups",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");*/

            migrationBuilder.AlterColumn<DateTime>(
                name: "MarkupUploadedAt",
                table: "markups",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MarkupOriginalFileName",
                table: "markups",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MarkupObjectName",
                table: "markups",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "MarkupFileSize",
                table: "markups",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_markups_records_IdRecord",
                table: "markups",
                column: "IdRecord",
                principalTable: "records",
                principalColumn: "IdRecord",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "IdRecord",
                table: "markups",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            /*migrationBuilder.AddColumn<string>(
                name: "MarkupObjectName",
                table: "markups",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "MarkupFileSize",
                table: "markups",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "MarkupOriginalFileName",
                table: "markups",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "MarkupUploadedAt",
                table: "markups",
                type: "timestamp with time zone",
                nullable: false,
                defaultValueSql: "CURRENT_TIMESTAMP");*/

            migrationBuilder.AlterColumn<DateTime>(
                name: "MarkupUploadedAt",
                table: "markups",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AlterColumn<string>(
                name: "MarkupOriginalFileName",
                table: "markups",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "MarkupObjectName",
                table: "markups",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<long>(
                name: "MarkupFileSize",
                table: "markups",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddForeignKey(
                name: "FK_markups_records_IdRecord",
                table: "markups",
                column: "IdRecord",
                principalTable: "records",
                principalColumn: "IdRecord",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
