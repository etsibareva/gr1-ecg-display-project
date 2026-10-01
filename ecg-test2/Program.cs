using DataAccess.Data;
using DataAccess.Services;
using WebApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddEnvironmentVariables()
    .Build();

builder.Services.AddSingleton<IConfiguration>(configuration);

// Читаем переменные
var dbHost = Environment.GetEnvironmentVariable("POSTGRES_HOST") ?? "postgres";
var dbName = Environment.GetEnvironmentVariable("POSTGRES_DB");
var dbUser = Environment.GetEnvironmentVariable("POSTGRES_USER") ?? "postgres";
var dbPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD");

// Проверка БД
if (string.IsNullOrEmpty(dbName))
{
    throw new InvalidOperationException("POSTGRES_DB not found in environment variables");
}
if (string.IsNullOrEmpty(dbPassword))
{
    throw new InvalidOperationException("POSTGRES_PASSWORD not found in environment variables");
}

var connectionString = $"Host={dbHost};Port=5432;Database={dbName};Username={dbUser};Password={dbPassword}";

// MinIO
var minioEndpoint = Environment.GetEnvironmentVariable("MINIO_ENDPOINT") ?? "minio:9000";

var minioAccessKey = Environment.GetEnvironmentVariable("MINIO_ACCESS_KEY")
    ?? Environment.GetEnvironmentVariable("MINIO_ROOT_USER");
if (string.IsNullOrEmpty(minioAccessKey))
{
    throw new InvalidOperationException("MinIO access key not found in environment variables");
}

var minioSecretKey = Environment.GetEnvironmentVariable("MINIO_SECRET_KEY")
    ?? Environment.GetEnvironmentVariable("MINIO_ROOT_PASSWORD");
if (string.IsNullOrEmpty(minioSecretKey))
{
    throw new InvalidOperationException("MinIO secret key not found in environment variables");
}

var signalsBucketName = Environment.GetEnvironmentVariable("MINIO_SIGNALS_BUCKET_NAME") ?? "tea_segmentator_signals";
var markupsBucketName = Environment.GetEnvironmentVariable("MINIO_MARKUPS_BUCKET_NAME") ?? "tea_segmentator_markups";

// Регистрация сервисов
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// Настройка MinIO
builder.Services.Configure<MinioOptions>(options =>
{
    options.Endpoint = minioEndpoint;
    options.AccessKey = minioAccessKey;
    options.SecretKey = minioSecretKey;
    options.SignalsBucketName = signalsBucketName;
    options.MarkupsBucketName = markupsBucketName;
});

builder.Services.AddScoped<NpyFileService>();
builder.Services.AddScoped<MarkupJsonService>();
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<RefreshTokenService>();
builder.Services.AddScoped<TokenBlacklistService>();

builder.Services.AddDistributedMemoryCache();
builder.Services.AddAuthorization();

// JWT
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET");
if (string.IsNullOrEmpty(jwtSecret))
{
    throw new InvalidOperationException("JWT_SECRET not found in environment variables");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "ECGApp",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "ECGApp",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// *** ДОБАВЛЯЕМ CORS ***
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            // Разрешаем все источники для разработки
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();

            // ИЛИ для продакшена - конкретные источники:
            //policy.WithOrigins(
            //     "http://127.0.0.1:5004",
            //     "http://localhost:5004",
            //     "http://frontend:80"  // если фронтенд в Docker сети
            //   )
            //   .AllowAnyMethod()
            //   .AllowAnyHeader()
            //   .AllowCredentials();  // если нужны куки/токены
        });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Инициализация бакетов
using (var scope = app.Services.CreateScope())
{
    var npyService = scope.ServiceProvider.GetRequiredService<NpyFileService>();
    var jsonService = scope.ServiceProvider.GetRequiredService<MarkupJsonService>();

    await npyService.InitializeAsync();
    await jsonService.InitializeAsync();

    Console.WriteLine($"Buckets initialized: {signalsBucketName}, {markupsBucketName}");
}

app.UseRouting();

app.UseCors("AllowFrontend");
//app.UseMiddleware<TokenBlackListMiddlewareService>();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();