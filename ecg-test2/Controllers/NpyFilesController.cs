using DataAccess.Data;
using DataAccess.Model;
using DataAccess.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApi.Logging;

namespace WebApi.Controllers
{
    public class CreateRecordRequest
    {
        public int IdDoctor { get; set; }
        public int RC { get; set; }
        public int Type { get; set; }
    }

    public class EcgDataResponse
    {
        public int RecordId { get; set; }
        public int SamplingRate { get; set; }
        public string[] ChannelNames { get; set; }
        public double[][] Channels { get; set; } // [12][5000]
    }

    [Route("api/[controller]")]
    [ApiController]
    public class NpyFilesController : ControllerBase
    {
        private readonly AppDbContext context;
        private readonly NpyFileService npyFileService;
        private readonly ILogger<NpyFilesController> logger;
        private readonly IFilesLogger _log;

        public NpyFilesController(AppDbContext _context, NpyFileService _npyFileService, ILogger<NpyFilesController> _logger, IFilesLogger log)
        {
            context = _context;
            npyFileService = _npyFileService;
            logger = _logger;
            _log = log;
        }

        [HttpPost("upload/{recordId}")]
        public async Task<IActionResult> UploadNpyFile(int recordId, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                _log.Warn($"NPY upload fail | recordId={recordId} | reason=empty_file");
                return BadRequest("NPY file is required");
            }

            if (Path.GetExtension(file.FileName).ToLower() != ".npy")
            {
                _log.Warn($"NPY upload fail | recordId={recordId} | reason=bad_extension | name={file.FileName}");
                return BadRequest("Only .npy files are supported");
            }

            var record = await context.records.FindAsync(recordId);
            if (record == null)
            {
                _log.Warn($"NPY upload fail | recordId={recordId} | reason=record_not_found");
                return NotFound($"Record with ID {recordId} not found");
            }

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

                _log.Info($"NPY upload ok | recordId={recordId} | size={file.Length} | name={file.FileName}");

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
                _log.Error(ex, $"NPY upload fail | recordId={recordId}");
                return StatusCode(500, "Error uploading NPY file");
            }
        }

        [HttpPost("create-record")]
        public async Task<IActionResult> CreateRecord([FromBody] CreateRecordRequest request)
        {
            try
            {
                // Добавляем проверку обязательных полей
                if (request == null)
                {
                    _log.Warn("NPY create-record fail | reason=empty_request");
                    return BadRequest("Request body is required");
                }

                if (request.IdDoctor <= 0)
                {
                    _log.Warn($"NPY create-record fail | reason=invalid_doctor_id | id={request.IdDoctor}");
                    return BadRequest("Valid doctor ID is required");
                }

                var doctor = await context.doctors.FindAsync(request.IdDoctor);
                if (doctor == null)
                {
                    _log.Warn($"NPY create-record fail | reason=doctor_not_found | id={request.IdDoctor}");
                    return BadRequest($"Doctor with ID {request.IdDoctor} not found");
                }

                var record = new Record
                {
                    IdDoctor = request.IdDoctor,
                    RC = request.RC,
                    Type = request.Type,
                    SignalObjectName = "",
                    SignalFileSize = 0,
                    SignalOriginalFileName = "",
                    SignalUploadedAt = DateTime.UtcNow,
                    Markups = new List<Markup>()
                };

                context.records.Add(record);
                await context.SaveChangesAsync();

                logger.LogInformation("Record created with ID: {RecordId}", record.IdRecord);

                _log.Info($"NPY create-record ok | recordId={record.IdRecord} | doctorId={request.IdDoctor}");

                return Ok(new
                {
                    RecordId = record.IdRecord,
                    Message = $"Record created successfully with ID: {record.IdRecord}"
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error creating record");
                _log.Error(ex, "NPY create-record fail");
                return StatusCode(500, "Error creating record");
            }
        }


        [HttpGet("download/{recordId}")]
        public async Task<IActionResult> DownloadNpySignal(int recordId)
        {
            var record = await context.records.FindAsync(recordId);
            if (record == null || string.IsNullOrEmpty(record.SignalObjectName))
            {
                _log.Warn($"NPY download fail | recordId={recordId} | reason=signal_not_found");
                return NotFound("Signal not found");
            }

            try
            {
                var npyData = await npyFileService.LoadNpyDataAsync(record.SignalObjectName);

                _log.Info($"NPY download ok | recordId={recordId} | size={npyData.Length}");

                return File(npyData, "application/octet-stream",
                    $"{record.SignalOriginalFileName ?? $"signal_{recordId}.npy"}");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error downloading NPY signal for record {RecordId}", recordId);
                _log.Error(ex, $"NPY download fail | recordId={recordId}");
                return StatusCode(500, "Error downloading signal file");
            }
        }

        [HttpGet("info/{recordId}")]
        public async Task<IActionResult> GetNpyFileInfo(int recordId)
        {
            var record = await context.records
                .Include(r => r.Markups)
                .FirstOrDefaultAsync(r => r.IdRecord == recordId);

            if (record == null)
            {
                _log.Warn($"NPY info fail | recordId={recordId} | reason=record_not_found");
                return NotFound("Record not found");
            }

            var hasFile = !string.IsNullOrEmpty(record.SignalObjectName);

            int samplingRate = record.Type switch
            {
                1 => 500,  // ЭКГ
                2 => 1000, // ММГ
                3 => 200,  // ЭЭГ
                _ => 500   // по умолчанию
            };

            _log.Info($"NPY info ok | recordId={recordId} | hasFile={hasFile}");

            return Ok(new
            {
                RecordId = recordId,
                HasNpyFile = hasFile,
                ObjectName = record.SignalObjectName,
                OriginalFileName = record.SignalOriginalFileName,
                FileSize = record.SignalFileSize,
                UploadedAt = record.SignalUploadedAt,
                SamplingRate = samplingRate,
                RC = record.RC,
                Type = record.Type,
                MarkupsCount = record.Markups?.Count ?? 0,
                Markups = record.Markups?.Select(m => new
                {
                    m.IdMarkup,
                    m.MarkupOriginalFileName,
                    m.MarkupUploadedAt
                })
            });
        }

        [HttpDelete("delete/{recordId}")]
        public async Task<IActionResult> DeleteNpyFile(int recordId)
        {
            var record = await context.records
                .Include(r => r.Markups)
                .FirstOrDefaultAsync(r => r.IdRecord == recordId);

            if (record == null || string.IsNullOrEmpty(record.SignalObjectName))
            {
                _log.Warn($"NPY delete fail | recordId={recordId} | reason=file_not_found");
                return NotFound("NPY file not found");
            }

            try
            {
                var success = await npyFileService.DeleteNpyDataAsync(record.SignalObjectName);
                if (success)
                {
                    if (record.Markups != null && record.Markups.Any())
                    {
                        logger.LogInformation("Record {RecordId} has {Count} markups that will also be deleted",
                            recordId, record.Markups.Count);
                    }

                    context.records.Remove(record);
                    await context.SaveChangesAsync();

                    logger.LogInformation("Record {RecordId} and its markups deleted", recordId);

                    _log.Info($"NPY delete ok | recordId={recordId} | markups={record.Markups?.Count ?? 0}");
                }

                if (!success)
                {
                    _log.Error($"NPY delete fail | recordId={recordId} | reason=service_returned_false");
                }

                return success ? Ok(new { Message = "Record deleted successfully" })
                               : StatusCode(500, "Error deleting record");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deleting record {RecordId}", recordId);
                _log.Error(ex, $"NPY delete fail | recordId={recordId}");
                return StatusCode(500, "Error deleting record");
            }
        }

        [HttpGet("doctor-records/{doctorId}")]
        public async Task<IActionResult> GetDoctorRecords(int doctorId)
        {
            var records = await context.records
                .Where(r => r.IdDoctor == doctorId)
                .Include(r => r.Markups)
                .OrderByDescending(r => r.SignalUploadedAt)
                .Take(15)
                .Select(r => new
                {
                    recordId = r.IdRecord,
                    type = r.Type,
                    uploadedAt = r.SignalUploadedAt,
                    fileSize = r.SignalFileSize,
                    originalFileName = r.SignalOriginalFileName,
                    markupsCount = r.Markups.Count
                })
                .ToListAsync();

            _log.Info($"NPY doctor-records ok | doctorId={doctorId} | count={records.Count}");

            return Ok(records);
        }

        [HttpGet("ecg-data/{recordId}")]
        public async Task<ActionResult<EcgDataResponse>> GetEcgData(int recordId)
        {
            try
            {
                var record = await context.records.FindAsync(recordId);
                if (record == null || string.IsNullOrEmpty(record.SignalObjectName))
                {
                    _log.Warn($"NPY ecg-data fail | recordId={recordId} | reason=record_or_file_not_found");
                    return NotFound("Record or NPY file not found");
                }

                var npyBytes = await npyFileService.LoadNpyDataAsync(record.SignalObjectName);

                if (npyBytes == null || npyBytes.Length == 0)
                {
                    _log.Warn($"NPY ecg-data fail | recordId={recordId} | reason=empty_file");
                    return BadRequest("NPY file is empty");
                }

                var array2D = NumSharp.np.Load<short[,]>(npyBytes);

                if (array2D == null)
                {
                    _log.Error($"NPY ecg-data fail | recordId={recordId} | reason=parse_failed");
                    return BadRequest("Failed to parse NPY file");
                }

                int rows = array2D.GetLength(0);
                int cols = array2D.GetLength(1);

                // Преобразуем short[,] в double[][]
                var ecgData = new double[rows][];
                for (int i = 0; i < rows; i++)
                {
                    ecgData[i] = new double[cols];
                    for (int j = 0; j < cols; j++)
                    {
                        ecgData[i][j] = array2D[i, j] / 1000.0;
                    }
                }

                var response = new EcgDataResponse
                {
                    RecordId = recordId,
                    SamplingRate = record.Type switch { 1 => 500, 2 => 1000, 3 => 200, _ => 500 },
                    Channels = ecgData,
                    ChannelNames = new[] { "I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6" }
                };

                _log.Info($"NPY ecg-data ok | recordId={recordId} | rows={rows} | cols={cols}");

                return Ok(response);
            }
            catch (Exception ex)
            {
                _log.Error(ex, $"NPY ecg-data fail | recordId={recordId}");
                return StatusCode(500, $"Error parsing ECG data: {ex.Message}");
            }
        }


    }
}