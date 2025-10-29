using DataAccess.Data;
using DataAccess.Services;
using WebApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using DotNetEnv;

var builder = WebApplication.CreateBuilder(args);

/* Загрузка конфигурации из DataAccess проекта */
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

/* (!) Убрать абсолютный путь (!) */
var envPath = @"C:\Users\Пользователь\source\repos\ecg\ecg-test2\DataAccess\.env";
Env.Load(envPath);

/* С целью хранение пароля postgres в env файле */
/* (!) Убрать значения по умолчанию (!) */
var dbHost     = Environment.GetEnvironmentVariable("POSTGRES_HOST") ?? "localhost";
var dbName     = Environment.GetEnvironmentVariable("POSTGRES_DB")   ?? "EcgDb";
var dbUser     = Environment.GetEnvironmentVariable("POSTGRES_USER") ?? "postgres";
var dbPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD");

/* (!) Убрать значения по умолчанию (!) */
var connectionString = $"Host={dbHost};Port=5432;Database={dbName};Username={dbUser};Password={dbPassword}";

/* Подключение к контексту */
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

/* Регистрация MinIO и Npy сервиса */
builder.Services.Configure<MinioOptions>(configuration.GetSection("Minio"));
builder.Services.AddScoped<NpyFileService>();

/* Регистрация сервисов авторизации */
builder.Services.AddScoped<PasswordService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<RefreshTokenService>();
builder.Services.AddScoped<TokenBlacklistService>();

/* Использование Redis для TokenBlackList */
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

/* Настройка CORS для запросов клиента Radzen */
/* (?) Явное указание портов стоит исключить? (?) */
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5003", "http://localhost:5101", "http://localhost:5104")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}


/* Вернуть при перенастройке фронт + бек на https */
//app.UseHttpsRedirection();

/* Если не гарантировано наличие bucket-а при загрузке */
/* (!) Новый bucket не создается! (!) */
using (var scope = app.Services.CreateScope())
{
    var npyService = scope.ServiceProvider.GetRequiredService<NpyFileService>();
    await npyService.InitializeAsync();
}

/* Настройка CORS для запросов клиента Radzen */
app.UseCors("AllowFrontend");
app.UseRouting();

/* Первый middleware - для проверки blacklist access токенов */
/* (?) Запускается ли? (?) */
app.UseMiddleware<TokenBlackListMiddlewareService>();
app.UseAuthentication();
app.UseAuthorization(); 
app.MapControllers();

app.Run();
