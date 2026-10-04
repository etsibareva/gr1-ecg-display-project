using DataAccess.Data;
using DataAccess.Model;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using WebApi.Logging;

/* (!) Четко определить, достаточно ли данного хеширования (для передачи, для хранения) refresh-токенов (!) */
/* (!) Если нет, ввести алгоритм SALT (!) */

namespace WebApi.Services
{
    public class RefreshTokenService
    {
        private readonly AppDbContext context;
        private readonly IConfiguration configuration;
        private readonly int refreshTokenExpiryDays;
        private readonly IAuthLogger _log;

        public RefreshTokenService(AppDbContext _context, IConfiguration _configuration, IAuthLogger log)
        {
            context = _context;
            configuration = _configuration;

            var jwtConfig = configuration.GetSection("Jwt");
            refreshTokenExpiryDays = int.Parse(jwtConfig["RefreshExpiryDays"]);

            _log = log;
        }

        /* Создание */
        public async Task<string> GenerateRefreshTokenAsync(int idDoctor)
        {
            var randomBytes = new byte[16];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(randomBytes);

            var refreshToken = Convert.ToBase64String(randomBytes);

            var tokenHash = HashToken(refreshToken);

            var refreshTokenEntity = new RefreshToken
            {
                IdDoctor = idDoctor,
                TokenHash = tokenHash,
                ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenExpiryDays),
                IsRevoked = false
            };

            context.refreshTokens.Add(refreshTokenEntity);
            await context.SaveChangesAsync();

            _log.Info($"REFRESH issue | id={idDoctor} | expiresDays={refreshTokenExpiryDays}");

            return refreshToken;
        }

        /* Проверка */
        public async Task<RefreshToken> VerifyRefreshTokenAsync(string token)
        {
            var tokenHash = HashToken(token);

            var refreshToken = await context.refreshTokens
                .Include(rt => rt.Doctor)
                .FirstOrDefaultAsync(rt =>
                    rt.TokenHash == tokenHash &&
                    !rt.IsRevoked &&
                    rt.ExpiresAt > DateTime.UtcNow);

            if (refreshToken == null)
                _log.Warn("REFRESH verify fail | reason=token_not_found_or_revoked");
            else
                _log.Info($"REFRESH verify ok | id={refreshToken.IdDoctor}");

            return refreshToken;
        }

        /* Отзыв */
        public async Task RevokeRefreshTokensAsync(int userId)
        {
            var activeTokens = await context.refreshTokens
                .Where(rt => rt.IdDoctor == userId && !rt.IsRevoked)
                .ToListAsync();

            foreach (var token in activeTokens)
            {
                token.IsRevoked = true;
            }

            await context.SaveChangesAsync();

            _log.Info($"REFRESH revoke_all | id={userId} | count={activeTokens.Count}");
        }

        /* Очистка отозванных */
        /* (!) Проблема 1: не вызывается автоматически (!) */
        /* (?) Проблема 2: не чистит БД или чистит (?) */
        public async Task CleanExpiredTokensAsync()
        {
            var expiredTokens = await context.refreshTokens
            .Where(rt => rt.ExpiresAt <= DateTime.UtcNow)
            .ToListAsync();

            if (expiredTokens.Any())
            {
                context.refreshTokens.RemoveRange(expiredTokens);
                await context.SaveChangesAsync();
                Console.WriteLine($"Cleaned up {expiredTokens.Count} expired tokens");

                _log.Info($"REFRESH cleanup | removed={expiredTokens.Count}");
            }
        }

        private static string HashToken(string token)
        {
            using var sha256 = SHA256.Create();
            var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
            return Convert.ToBase64String(hashBytes);
        }
    }
}