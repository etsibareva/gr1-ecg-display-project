using DataAccess.Data;
using DataAccess.Model;
using DataAccess.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WebApi.Logging;

namespace WebApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MarkupJsonController : ControllerBase
    {
        private readonly AppDbContext context;
        private readonly MarkupJsonService markupJsonService;
        private readonly ILogger<MarkupJsonController> logger;
        private readonly IFilesLogger _log;

        public MarkupJsonController(
            AppDbContext _context,
            MarkupJsonService _markupJsonService,
            ILogger<MarkupJsonController> _logger,
            IFilesLogger log)
        {
            context = _context;
            markupJsonService = _markupJsonService;
            logger = _logger;
            _log = log;
        }


        // Создание разметки для конкретной записи
        [HttpPost("create-for-record/{recordId}")]
        public async Task<IActionResult> CreateMarkupForRecord(int recordId)
        {
            var record = await context.records.FindAsync(recordId);
            if (record == null)
            {
                _log.Warn($"JSON markup create fail | recordId={recordId} | reason=record_not_found");
                return NotFound($"Record with ID {recordId} not found");
            }

            var markup = new Markup
            {
                IdRecord = recordId,
                CreatedAt = DateTime.UtcNow
            };

            context.markups.Add(markup);
            await context.SaveChangesAsync();

            logger.LogInformation("Markup created for record {RecordId} with ID: {MarkupId}",
                recordId, markup.IdMarkup);

            _log.Info($"JSON markup create ok | recordId={recordId} | markupId={markup.IdMarkup}");

            return Ok(new
            {
                MarkupId = markup.IdMarkup,
                RecordId = recordId,
                Message = $"Markup created for record {recordId}"
            });
        }

        // Загрузка JSON файла для существующей разметки
        [HttpPost("upload/{markupId}")]
        public async Task<IActionResult> UploadMarkupJson(int markupId, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                _log.Warn($"JSON markup upload fail | markupId={markupId} | reason=empty_file");
                return BadRequest("JSON file is required");
            }

            var extension = Path.GetExtension(file.FileName).ToLower();
            if (extension != ".json")
            {
                _log.Warn($"JSON markup upload fail | markupId={markupId} | reason=bad_extension | ext={extension}");
                return BadRequest("Only .json files are supported");
            }

            var markup = await context.markups
                .Include(m => m.Record)
                .FirstOrDefaultAsync(m => m.IdMarkup == markupId);

            if (markup == null)
            {
                _log.Warn($"JSON markup upload fail | markupId={markupId} | reason=markup_not_found");
                return NotFound($"Markup with ID {markupId} not found");
            }

            try
            {
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                var jsonContent = System.Text.Encoding.UTF8.GetString(stream.ToArray());

                try
                {
                    JsonDocument.Parse(jsonContent);
                }
                catch (JsonException)
                {
                    _log.Warn($"JSON markup upload fail | markupId={markupId} | reason=invalid_json");
                    return BadRequest("Invalid JSON format");
                }

                var (objectName, fileSize) = await markupJsonService.SaveJsonAsync(jsonContent, markupId);

                // Обновляем поля разметки
                markup.MarkupObjectName = objectName;
                markup.MarkupFileSize = fileSize;
                markup.MarkupOriginalFileName = file.FileName;
                markup.MarkupUploadedAt = DateTime.UtcNow;

                await context.SaveChangesAsync();

                logger.LogInformation("JSON markup uploaded for markup {MarkupId} (record {RecordId})",
                    markupId, markup.IdRecord);

                _log.Info($"JSON markup upload ok | markupId={markupId} | recordId={markup.IdRecord} | size={fileSize} | name={file.FileName}");

                return Ok(new
                {
                    MarkupId = markupId,
                    RecordId = markup.IdRecord,
                    ObjectName = objectName,
                    FileSize = fileSize,
                    OriginalFileName = file.FileName
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error uploading JSON markup for markup {MarkupId}", markupId);
                _log.Error(ex, $"JSON markup upload fail | markupId={markupId}");
                return StatusCode(500, "Error uploading JSON markup");
            }
        }

        // Получить все разметки для записи        
        [HttpGet("record-markups/{recordId}")]
        public async Task<IActionResult> GetRecordMarkups(int recordId)
        {
            var record = await context.records.FindAsync(recordId);
            if (record == null)
            {
                _log.Warn($"JSON markup list fail | recordId={recordId} | reason=record_not_found");
                return NotFound($"Record with ID {recordId} not found");
            }

            var markups = await context.markups
                .Where(m => m.IdRecord == recordId)
                .OrderByDescending(m => m.CreatedAt)
                .Select(m => new
                {
                    m.IdMarkup,
                    m.MarkupFileSize,
                    m.MarkupOriginalFileName,
                    m.MarkupUploadedAt,
                    m.CreatedAt
                })
                .ToListAsync();

            _log.Info($"JSON markup list ok | recordId={recordId} | count={markups.Count}");

            return Ok(new
            {
                RecordId = recordId,
                MarkupsCount = markups.Count,
                Markups = markups
            });
        }

        // Скачать JSON разметки
        [HttpGet("download/{markupId}")]
        public async Task<IActionResult> DownloadMarkupJson(int markupId)
        {
            var markup = await context.markups.FindAsync(markupId);
            if (markup == null)
            {
                _log.Warn($"JSON markup download fail | markupId={markupId} | reason=markup_not_found");
                return NotFound($"Markup with ID {markupId} not found");
            }

            if (string.IsNullOrEmpty(markup.MarkupObjectName))
            {
                _log.Warn($"JSON markup download fail | markupId={markupId} | reason=object_name_empty");
                return NotFound("JSON markup file not found");
            }

            try
            {
                var jsonContent = await markupJsonService.LoadJsonAsync(markup.MarkupObjectName);
                _log.Info($"JSON markup download ok | markupId={markupId} | recordId={markup.IdRecord}");
                return Content(jsonContent, "application/json", System.Text.Encoding.UTF8);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error downloading JSON markup {MarkupId}", markupId);
                _log.Error(ex, $"JSON markup download fail | markupId={markupId}");
                return StatusCode(500, "Error downloading JSON markup");
            }
        }


        // Удалить разметку
        [HttpDelete("delete/{markupId}")]
        public async Task<IActionResult> DeleteMarkup(int markupId)
        {
            var markup = await context.markups.FindAsync(markupId);
            if (markup == null)
            {
                _log.Warn($"JSON markup delete fail | markupId={markupId} | reason=markup_not_found");
                return NotFound($"Markup with ID {markupId} not found");
            }

            try
            {
                if (!string.IsNullOrEmpty(markup.MarkupObjectName))
                {
                    await markupJsonService.DeleteJsonAsync(markup.MarkupObjectName);
                }

                context.markups.Remove(markup);
                await context.SaveChangesAsync();

                logger.LogInformation("Markup {MarkupId} deleted (record {RecordId})",
                    markupId, markup.IdRecord);

                _log.Info($"JSON markup delete ok | markupId={markupId} | recordId={markup.IdRecord}");

                return Ok(new { Message = "Markup deleted successfully" });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deleting markup {MarkupId}", markupId);
                _log.Error(ex, $"JSON markup delete fail | markupId={markupId}");
                return StatusCode(500, "Error deleting markup");
            }
        }
    }
}