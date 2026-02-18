using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using System.Text;
using System.Text.Json;

namespace DataAccess.Services
{
    public class MarkupJsonService
    {
        private readonly string markupBucketName;
        private const string JSON_CONTENT_TYPE = "application/json";
        private readonly ILogger<MarkupJsonService> logger;
        private readonly IMinioClient minioClient;

        public MarkupJsonService(IOptions<MinioOptions> minioOptions, ILogger<MarkupJsonService> _logger)
        {
            var endpoint = Environment.GetEnvironmentVariable("MINIO_ENDPOINT") ?? "localhost:9000";
            var accessKey = Environment.GetEnvironmentVariable("MINIO_ACCESS_KEY")
                ?? throw new ArgumentNullException("MINIO_ACCESS_KEY not set");
            var secretKey = Environment.GetEnvironmentVariable("MINIO_SECRET_KEY")
                ?? throw new ArgumentNullException("MINIO_SECRET_KEY not set");

            markupBucketName = Environment.GetEnvironmentVariable("MINIO_MARKUP_BUCKET_NAME")
                ?? minioOptions.Value.MarkupBucketName;

            minioClient = new MinioClient()
                .WithEndpoint(endpoint)
                .WithCredentials(accessKey, secretKey)
                .WithSSL(false)
                .Build();

            logger = _logger;
        }

        public async Task InitializeAsync()
        {
            try
            {
                var bucketExistsArgs = new BucketExistsArgs().WithBucket(markupBucketName);
                bool found = await minioClient.BucketExistsAsync(bucketExistsArgs);

                if (!found)
                {
                    var makeBucketArgs = new MakeBucketArgs().WithBucket(markupBucketName);
                    await minioClient.MakeBucketAsync(makeBucketArgs);
                    logger.LogInformation("Bucket {BucketName} created", markupBucketName);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error initializing MinIO markup bucket");
                throw;
            }
        }

        /* Сохранение JSON строки */
        public async Task<(string objectName, long fileSize)> SaveJsonAsync(string jsonContent, int markupId)
        {
            try
            {
                var objectName = $"markups/markup_{markupId}_{Guid.NewGuid():N}.json";
                var byteArray = Encoding.UTF8.GetBytes(jsonContent);

                using var stream = new MemoryStream(byteArray);

                var putObjectArgs = new PutObjectArgs()
                    .WithBucket(markupBucketName)
                    .WithObject(objectName)
                    .WithStreamData(stream)
                    .WithObjectSize(stream.Length)
                    .WithContentType(JSON_CONTENT_TYPE);

                await minioClient.PutObjectAsync(putObjectArgs);

                logger.LogInformation("JSON markup saved: {ObjectName}, size: {Size} bytes",
                    objectName, stream.Length);

                return (objectName, stream.Length);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error saving JSON markup for MarkupId {MarkupId}", markupId);
                throw;
            }
        }

        /* Сохранение объекта как JSON */
        public async Task<(string objectName, long fileSize)> SaveObjectAsJsonAsync<T>(T obj, int markupId)
        {
            var jsonContent = JsonSerializer.Serialize(obj, new JsonSerializerOptions
            {
                WriteIndented = true
            });

            return await SaveJsonAsync(jsonContent, markupId);
        }

        /* Загрузка JSON строки */
        public async Task<string> LoadJsonAsync(string objectName)
        {
            try
            {
                using var memoryStream = new MemoryStream();

                var getObjectArgs = new GetObjectArgs()
                    .WithBucket(markupBucketName)
                    .WithObject(objectName)
                    .WithCallbackStream(stream => stream.CopyTo(memoryStream));

                await minioClient.GetObjectAsync(getObjectArgs);

                memoryStream.Position = 0;
                using var reader = new StreamReader(memoryStream, Encoding.UTF8);
                var jsonContent = await reader.ReadToEndAsync();

                logger.LogInformation("JSON markup loaded: {ObjectName}", objectName);
                return jsonContent;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error loading JSON markup {ObjectName}", objectName);
                throw;
            }
        }

        /* Загрузка и десериализация JSON в объект */
        public async Task<T> LoadJsonAsObjectAsync<T>(string objectName)
        {
            var jsonContent = await LoadJsonAsync(objectName);
            return JsonSerializer.Deserialize<T>(jsonContent)
                ?? throw new InvalidOperationException("Failed to deserialize JSON");
        }

        /* Получение URL для скачивания */
        public async Task<string> GetJsonFileUrlAsync(string objectName, int expiryMinutes = 60)
        {
            try
            {
                var presignedGetObjectArgs = new PresignedGetObjectArgs()
                    .WithBucket(markupBucketName)
                    .WithObject(objectName)
                    .WithExpiry(expiryMinutes * 60);

                var url = await minioClient.PresignedGetObjectAsync(presignedGetObjectArgs);
                return url;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error generating URL for JSON file {ObjectName}", objectName);
                throw;
            }
        }

        /* Удаление JSON файла */
        public async Task<bool> DeleteJsonAsync(string objectName)
        {
            try
            {
                var removeObjectArgs = new RemoveObjectArgs()
                    .WithBucket(markupBucketName)
                    .WithObject(objectName);

                await minioClient.RemoveObjectAsync(removeObjectArgs);

                logger.LogInformation("JSON markup deleted: {ObjectName}", objectName);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deleting JSON markup {ObjectName}", objectName);
                return false;
            }
        }

        /* Проверка существования файла */
        public async Task<bool> JsonExistsAsync(string objectName)
        {
            try
            {
                var statObjectArgs = new StatObjectArgs()
                    .WithBucket(markupBucketName)
                    .WithObject(objectName);

                var stat = await minioClient.StatObjectAsync(statObjectArgs);
                return stat != null;
            }
            catch
            {
                return false;
            }
        }
    }
}