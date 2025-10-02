using DataAccess.Data;
using DataAccess.Model;
using DataAccess.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ecg_test2.Controllers
{
    public class CreateRecordRequest
    {
        public int IdDoctor { get; set; }
        public int RC { get; set; }
        public int Type { get; set; }
        public int IdMarkup { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class NpyFilesController : ControllerBase
    {
        private readonly AppDbContext context;
        private readonly NpyFileService npyFileService;
        private readonly ILogger<NpyFilesController> logger;

        public NpyFilesController(AppDbContext _context, NpyFileService _npyFileService, ILogger<NpyFilesController> _logger)
        {
            context = _context;
            npyFileService = _npyFileService;
            logger = _logger;
        }

        [HttpPost("upload/{recordId}")]
        public async Task<IActionResult> UploadNpyFile(int recordId, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("NPY file is required");

            if (Path.GetExtension(file.FileName).ToLower() != ".npy")
                return BadRequest("Only .npy files are supported");

            var record = await context.records.FindAsync(recordId);
            if (record == null)
                return NotFound($"Record with ID {recordId} not found");

            try
            {
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                var npyData = stream.ToArray();

                var objectName = await npyFileService.SaveNpyDataAsync(npyData, file.FileName);

                record.SignalObjectName = objectName;
                record.SignalFileSize = file.Length;
                record.SignalOriginalFileName = file.FileName;
                record.SignalUploadedAt = DateTime.UtcNow;

                await context.SaveChangesAsync();

                logger.LogInformation("NPY file uploaded for record {RecordId}", recordId);

                return Ok(new
                {
                    ObjectName = objectName,
                    FileSize = file.Length,
                    OriginalFileName = file.FileName,
                    RecordId = recordId
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error uploading NPY file for record {RecordId}", recordId);
                return StatusCode(500, "Error uploading NPY file");
            }
        }

        // сохранение record Postgres (без существования записи невозможно)
        [HttpPost("create-record")]
        public async Task<IActionResult> CreateRecord([FromBody] CreateRecordRequest request)
        {
            try
            {
                var doctor = await context.doctors.FindAsync(request.IdDoctor);
                if (doctor == null)
                {
                    return BadRequest($"Doctor with ID {request.IdDoctor} not found");
                }

                var markup = await context.markups.FindAsync(request.IdMarkup);
                if (markup == null)
                {
                    return BadRequest($"Markup with ID {request.IdMarkup} not found");
                }

                var record = new Record
                {
                    IdDoctor = request.IdDoctor,
                    RC = request.RC,
                    Type = request.Type,
                    IdMarkup = request.IdMarkup,
                    SignalObjectName = "",
                    SignalFileSize = 0,
                    SignalOriginalFileName = "",
                    SignalUploadedAt = DateTime.UtcNow
                };

                context.records.Add(record);
                await context.SaveChangesAsync();

                logger.LogInformation("Record created with ID: {RecordId}", record.IdRecord);

                return Ok(new
                {
                    RecordId = record.IdRecord,
                    Message = $"Record created successfully with ID: {record.IdRecord}"
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error creating record");
                return StatusCode(500, "Error creating record");
            }
        }

        [HttpGet("download/{recordId}")]
        public async Task<IActionResult> DownloadNpySignal(int recordId)
        {
            var record = await context.records.FindAsync(recordId);
            if (record == null || string.IsNullOrEmpty(record.SignalObjectName))
                return NotFound("Signal not found");

            try
            {
                var npyData = await npyFileService.LoadNpyDataAsync(record.SignalObjectName);

                return File(npyData, "application/octet-stream",
                    $"{record.SignalOriginalFileName ?? $"signal_{recordId}.npy"}");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error downloading NPY signal for record {RecordId}", recordId);
                return StatusCode(500, "Error downloading signal file");
            }
        }

        [HttpGet("info/{recordId}")]
        public async Task<IActionResult> GetNpyFileInfo(int recordId)
        {
            var record = await context.records.FindAsync(recordId);
            if (record == null)
                return NotFound("Record not found");

            var hasFile = !string.IsNullOrEmpty(record.SignalObjectName);

            return Ok(new
            {
                RecordId = recordId,
                HasNpyFile = hasFile,
                ObjectName = record.SignalObjectName,
                OriginalFileName = record.SignalOriginalFileName,
                FileSize = record.SignalFileSize,
                UploadedAt = record.SignalUploadedAt
            });
        }

        [HttpGet("url/{recordId}")]
        public async Task<IActionResult> GetNpyFileUrl(int recordId)
        {
            var record = await context.records.FindAsync(recordId);
            if (record == null || string.IsNullOrEmpty(record.SignalObjectName))
                return NotFound("NPY file not found");

            try
            {
                var url = await npyFileService.GetNpyFileUrlAsync(record.SignalObjectName);
                return Ok(new { Url = url });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error generating URL for NPY file {RecordId}", recordId);
                return StatusCode(500, "Error generating file URL");
            }
        }

        [HttpDelete("delete/{recordId}")]
        public async Task<IActionResult> DeleteNpyFile(int recordId)
        {
            var record = await context.records.FindAsync(recordId);
            if (record == null || string.IsNullOrEmpty(record.SignalObjectName))
                return NotFound("NPY file not found");

            try
            {
                var success = await npyFileService.DeleteNpyDataAsync(record.SignalObjectName);
                if (success)
                {
                    //record.SignalObjectName = string.Empty;
                    //record.SignalFileSize = 0;
                    //record.SignalOriginalFileName = string.Empty;

                    context.records.Remove(record);
                    await context.SaveChangesAsync();

                    logger.LogInformation("NPY file deleted for record {RecordId}", recordId);
                }

                return success ? Ok(new { Message = "NPY file deleted successfully" })
                              : StatusCode(500, "Error deleting NPY file");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deleting NPY file for record {RecordId}", recordId);
                return StatusCode(500, "Error deleting NPY file");
            }
        }


        // вариант объединенный - требует странной отправки данных (не json, а через параметры POST-запроса) 
        /*
        [HttpPost("safe")]
        public async Task<IActionResult> UploadNpyFile([FromForm] CreateRecordRequest request, [FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("NPY file is required");

            if (Path.GetExtension(file.FileName).ToLower() != ".npy")
                return BadRequest("Only .npy files are supported");

            try
            {
                // Проверка существования связанных сущностей
                var doctor = await context.doctors.FindAsync(request.IdDoctor);
                if (doctor == null)
                    return BadRequest($"Doctor with ID {request.IdDoctor} not found");

                var markup = await context.markups.FindAsync(request.IdMarkup);
                if (markup == null)
                    return BadRequest($"Markup with ID {request.IdMarkup} not found");

                // Создание записи
                var record = new Record
                {
                    IdDoctor = request.IdDoctor,
                    RC = request.RC,
                    Type = request.Type,
                    IdMarkup = request.IdMarkup,
                    SignalObjectName = "",
                    SignalFileSize = 0,
                    SignalOriginalFileName = "",
                    SignalUploadedAt = DateTime.UtcNow
                };

                context.records.Add(record);
                await context.SaveChangesAsync();

                // Загрузка файла в MinIO
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                var npyData = stream.ToArray();

                var objectName = await npyFileService.SaveNpyDataAsync(npyData, file.FileName);

                // Обновление записи с информацией о файле
                record.SignalObjectName = objectName;
                record.SignalFileSize = file.Length;
                record.SignalOriginalFileName = file.FileName;
                record.SignalUploadedAt = DateTime.UtcNow;

                await context.SaveChangesAsync();

                logger.LogInformation("Record created and NPY file uploaded with ID: {RecordId}", record.IdRecord);

                return Ok(new
                {
                    RecordId = record.IdRecord,
                    ObjectName = objectName,
                    FileSize = file.Length,
                    OriginalFileName = file.FileName,
                    Message = $"Record created successfully with ID: {record.IdRecord}"
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error creating record and uploading file");
                return StatusCode(500, "Error creating record and uploading file");
            }
        }*/
    }
}
