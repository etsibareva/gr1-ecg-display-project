using DataAccess.Model;
using Microsoft.Extensions.Caching.Distributed;
using System.Security.Cryptography;
using System.Text;

namespace ecg_test2.Services
{
    public class TokenBlacklistService
    {
        private readonly IDistributedCache cache;

        public TokenBlacklistService(IDistributedCache _cache)
        {
            cache = _cache;
        }

        public async Task<bool> IsTokenBlacklistedAsync(string token)
        {
            var tokenHash = HashToken(token);
            var cachedValue = await cache.GetStringAsync($"blacklist:{tokenHash}");
            return cachedValue != null;
        }

        public async Task AddToBlacklistAsync(string token, TimeSpan expiry)
        {
            var tokenHash = HashToken(token);
            await cache.SetStringAsync(
                $"blacklist:{tokenHash}",
                "revoked",
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = expiry }
            );
        }

        private static string HashToken(string token)
        {
            using var sha256 = SHA256.Create();
            var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
            return Convert.ToBase64String(hashBytes);
        }
    }
}