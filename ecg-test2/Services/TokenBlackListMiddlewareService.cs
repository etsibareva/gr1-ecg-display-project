namespace ecg_test2.Services
{
    public class TokenBlackListMiddlewareService
    {
        private readonly RequestDelegate next;

        public TokenBlackListMiddlewareService(RequestDelegate _next)
        {
            next = _next;
        }

        public async Task InvokeAsync(HttpContext context, TokenBlacklistService blacklistService)
        {
            if (context.Request.Path.StartsWithSegments("/api/auth/login") ||
                context.Request.Path.StartsWithSegments("/api/auth/register") ||
                context.Request.Path.StartsWithSegments("/api/auth/refresh"))
            {
                await next(context);
                return;
            }

            // Проверяем токен только для защищенных routes
            var token = context.Request.Headers["Authorization"]
                .FirstOrDefault()?
                .Replace("Bearer ", "");

            if (!string.IsNullOrEmpty(token) &&
                await blacklistService.IsTokenBlacklistedAsync(token))
            {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsync("Token revoked");
                return;
            }

            await next(context);
        }
    }
}
