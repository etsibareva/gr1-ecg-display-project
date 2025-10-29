using DataAccess.Data;
using DataAccess.Model;
using DataAccess.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NumSharp;
using NumSharp.Backends.Unmanaged;
using System;
using static System.Net.WebRequestMethods;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace WebApi.Controllers
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

        /* Сохранение записи Record в Postgres (без существования записи невозможно сохранения NPY в MinIO) */
        /* (!) Требуется админский скрипт для последовательного create-record + upload при загрузке NPY. (!) */
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

            // Определяем частоту дискретизации по типу сигнала
            int samplingRate = record.Type switch
            {
                1 => 500,  // ЭКГ
                2 => 1000, // ММГ
                3 => 200,  // ЭЭГ
                _ => 500   // по умолчанию
            };

            return Ok(new
            {
                /* (?) Убрать не используемые поля (?) */
                RecordId = recordId,
                HasNpyFile = hasFile,
                ObjectName = record.SignalObjectName,
                OriginalFileName = record.SignalOriginalFileName,
                FileSize = record.SignalFileSize,
                UploadedAt = record.SignalUploadedAt,
                SamplingRate = samplingRate,
                RC = record.RC,
                Type = record.Type
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

        [HttpGet("doctor-records/{doctorId}")]
        public async Task<IActionResult> GetDoctorRecords(int doctorId)
        {
            var records = await context.records
                .Where(r => r.IdDoctor == doctorId)
                .OrderByDescending(r => r.SignalUploadedAt)
                .Take(15) 
                .Select(r => new
                {
                    recordId = r.IdRecord,
                    type = r.Type,
                    uploadedAt = r.SignalUploadedAt,
                    fileSize = r.SignalFileSize,
                    originalFileName = r.SignalOriginalFileName
                })
                .ToListAsync();

            return Ok(records);
        }

        [HttpGet("ecg-data/{recordId}")]
        public async Task<ActionResult<EcgDataResponse>> GetEcgData(int recordId)
        {
            try
            {
                var record = await context.records.FindAsync(recordId);
                if (record == null || string.IsNullOrEmpty(record.SignalObjectName))
                    return NotFound("Record or NPY file not found");

                var npyBytes = await npyFileService.LoadNpyDataAsync(record.SignalObjectName);

                if (npyBytes == null || npyBytes.Length == 0)
                    return BadRequest("NPY file is empty");

                // Парсим как ДВУМЕРНЫЙ массив short[,]
                var array2D = NumSharp.np.Load<short[,]>(npyBytes);

                if (array2D == null)
                    return BadRequest("Failed to parse NPY file");

                int rows = array2D.GetLength(0);
                int cols = array2D.GetLength(1);

                // Преобразуем short[,] в double[][]
                var ecgData = new double[rows][];
                for (int i = 0; i < rows; i++)
                {
                    ecgData[i] = new double[cols];
                    for (int j = 0; j < cols; j++)
                    {
                        ecgData[i][j] = array2D[i, j]/1000.0;
                    }
                }

                var response = new EcgDataResponse
                {
                    RecordId = recordId,
                    SamplingRate = record.Type switch { 1 => 500, 2 => 1000, 3 => 200, _ => 500 },
                    Channels = ecgData,
                    ChannelNames = new[] { "I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6" }
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error parsing ECG data: {ex.Message}");
            }
        }
        
        public class EcgDataResponse
        {
            public int RecordId { get; set; }
            public int SamplingRate { get; set; }
            public string[] ChannelNames { get; set; }
            public double[][] Channels { get; set; } // [12][5000]
        }
    }
}
