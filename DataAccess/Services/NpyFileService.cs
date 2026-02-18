using Microsoft.Build.Framework;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Minio;
using Minio.ApiEndpoints;
using Minio.DataModel.Args;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DataAccess.Services
{
    public partial class MinioOptions
    {
        public string Endpoint { get; set; } = string.Empty;
        public string AccessKey { get; set; } = string.Empty;
        public string SecretKey { get; set; } = string.Empty;
        public bool WithSSL { get; set; }

        /* (!) Избавиться от значения по умолчанию (!) */
        public string BucketName { get; set; } = "signals";

        public string MarkupBucketName { get; set; } = "markups";
    }

    public partial class NpyFileService
    {
        private readonly string bucketName;
        private const string NPY_CONTENT_TYPE = "application/octet-stream";
        private readonly ILogger<NpyFileService> logger;
        private readonly IMinioClient minioClient;

        public NpyFileService(IOptions<MinioOptions> minioOptions, ILogger<NpyFileService> _logger)
        {
            /* (!) Избавиться от всех значений по умолчанию. Тестировать. (!) */
            var endpoint = Environment.GetEnvironmentVariable("MINIO_ENDPOINT") ?? "localhost:9000";
            
            var accessKey = Environment.GetEnvironmentVariable("MINIO_ACCESS_KEY")
                ?? throw new ArgumentNullException("MINIO_ACCESS_KEY not set");
            
            var secretKey = Environment.GetEnvironmentVariable("MINIO_SECRET_KEY")
                ?? throw new ArgumentNullException("MINIO_SECRET_KEY not set");
            
            bucketName = Environment.GetEnvironmentVariable("MINIO_BUCKET_NAME") ?? "signals";
            /* (!) */

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
                var bucketExistsArgs = new BucketExistsArgs().WithBucket(bucketName);
                bool found = await minioClient.BucketExistsAsync(bucketExistsArgs);
                var makeBucketArgs = new MakeBucketArgs().WithBucket(bucketName);
                await minioClient.MakeBucketAsync(makeBucketArgs);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error initializing MinIO bucket");
                throw;
            }
        }

        /* Загрузка файла NPY в виде массива байт */
        public async Task<string> SaveNpyDataAsync(byte[] npyData, string fileName)
        {
            try
            {
                var objectName = $"npy/{Guid.NewGuid()}_{Path.GetFileNameWithoutExtension(fileName)}.npy";

                using var stream = new MemoryStream(npyData);

                var putObjectArgs = new PutObjectArgs()
                    .WithBucket(bucketName)
                    .WithObject(objectName)
                    .WithStreamData(stream)
                    .WithObjectSize(stream.Length)
                    .WithContentType(NPY_CONTENT_TYPE);

                await minioClient.PutObjectAsync(putObjectArgs);

                return objectName;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error saving NPY file {FileName}", fileName);
                throw;
            }
        }

        /* Получение файла NPY в виде массива байт */
        public async Task<byte[]> LoadNpyDataAsync(string objectName)
        {
            try
            {
                using var memoryStream = new MemoryStream();

                var getObjectArgs = new GetObjectArgs()
                    .WithBucket(bucketName)
                    .WithObject(objectName)
                    .WithCallbackStream(stream => stream.CopyTo(memoryStream));

                await minioClient.GetObjectAsync(getObjectArgs);

                logger.LogInformation("NPY file {ObjectName} loaded successfully", objectName);
                return memoryStream.ToArray();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error loading NPY file {ObjectName}", objectName);
                throw;
            }
        }

        /* Возврат ссылки на скачивание */
        public async Task<string> GetNpyFileUrlAsync(string objectName, int expiryMinutes = 60)
        {
            try
            {
                var presignedGetObjectArgs = new PresignedGetObjectArgs()
                    .WithBucket(bucketName)
                    .WithObject(objectName)
                    .WithExpiry(expiryMinutes * 60);

                var url = await minioClient.PresignedGetObjectAsync(presignedGetObjectArgs);
                return url;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error generating URL for NPY file {ObjectName}", objectName);
                throw;
            }
        }

        /* Удаление записи в MinIO */
        public async Task<bool> DeleteNpyDataAsync(string objectName)
        {
            try
            {
                var removeObjectArgs = new RemoveObjectArgs()
                    .WithBucket(bucketName)
                    .WithObject(objectName);

                await minioClient.RemoveObjectAsync(removeObjectArgs);

                logger.LogInformation("NPY file deleted: {ObjectName}", objectName);
                return true;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deleting NPY file {ObjectName}", objectName);
                return false;
            }
        }
    }
}
