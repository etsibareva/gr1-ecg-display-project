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

namespace ecg_test2.Services
{
    public class RefreshTokenService
    {
        private readonly AppDbContext context;
        private readonly IConfiguration configuration;
        private readonly int refreshTokenExpiryDays;

        public RefreshTokenService(AppDbContext _context, IConfiguration _configuration)
        {
            context = _context;
            configuration = _configuration;

            var jwtConfig = configuration.GetSection("Jwt");
            refreshTokenExpiryDays = int.Parse(jwtConfig["RefreshExpiryDays"]);
        }

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

            return refreshToken;
        }

        public async Task<RefreshToken> VerifyRefreshTokenAsync(string token)
        {
            var tokenHash = HashToken(token);

            var refreshToken = await context.refreshTokens
                .Include(rt => rt.Doctor)
                .FirstOrDefaultAsync(rt =>
                    rt.TokenHash == tokenHash &&
                    !rt.IsRevoked &&
                    rt.ExpiresAt > DateTime.UtcNow);

            return refreshToken;
        }

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
        }

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
