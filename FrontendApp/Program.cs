var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

// Разрешаем serving статических файлов из wwwroot
app.UseStaticFiles();

app.MapGet("/", () => Results.Redirect("/login.html"));

// Для SPA - если запрос не найден, отдаём index.html
app.MapFallbackToFile("index.html");

app.Run();
