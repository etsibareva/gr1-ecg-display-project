using DataAccess.Data;
using DataAccess.Services;
using ecg_test2.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using DotNetEnv;

var builder = WebApplication.CreateBuilder(args);

// Загрузка конфигурации из DataAccess проекта
var configuration = new ConfigurationBuilder()
    .SetBasePath(Path.Combine(Directory.GetCurrentDirectory(), "..", "DataAccess"))
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddEnvironmentVariables()
    .Build();

// Регистрирация конфигурации
builder.Services.AddSingleton<IConfiguration>(configuration);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var envPath = @"C:\Users\Пользователь\source\repos\ecg\ecg-test2\DataAccess\.env";
Env.Load(envPath);

// с целью хранение пароля postgres в env файле
var dbHost     = Environment.GetEnvironmentVariable("POSTGRES_HOST") ?? "localhost";
var dbName     = Environment.GetEnvironmentVariable("POSTGRES_DB")   ?? "EcgDb";
var dbUser     = Environment.GetEnvironmentVariable("POSTGRES_USER") ?? "postgres";
var dbPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD");

var connectionString = $"Host={dbHost};Port=5432;Database={dbName};Username={dbUser};Password={dbPassword}";

// подключение к контексту
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

// регистрация MinIO и Npy сервиса
builder.Services.Configure<MinioOptions>(configuration.GetSection("Minio"));
builder.Services.AddScoped<NpyFileService>();

//регистрация сервисов авторизации
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<RefreshTokenService>();
builder.Services.AddScoped<TokenBlacklistService>();

// использование Redis для TokenBlackList
/*builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    options.InstanceName = "AuthApp:";
});*/

builder.Services.AddDistributedMemoryCache();
builder.Services.AddAuthorization();

var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options => 
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// если не гарантировано наличие bucket-а при загрузке (вопрос переносимости ?)
using (var scope = app.Services.CreateScope())
{
    var npyService = scope.ServiceProvider.GetRequiredService<NpyFileService>();
    await npyService.InitializeAsync();
}

// первый middleware - для проверки blacklist access токенов
app.UseMiddleware<TokenBlackListMiddlewareService>();
app.UseAuthentication();
app.UseAuthorization(); 
app.MapControllers();

app.Run();
