using DataAccess.Model;
using Microsoft.Extensions.Caching.Distributed;
using System.Security.Cryptography;
using System.Text;
using WebApi.Logging;

/* (!) Неясно, запускается ли вообще (!) */
/* (!) Есть зависание запуска при многократном использовании (!) */

namespace WebApi.Services
{
    public class TokenBlacklistService
    {
        private readonly IDistributedCache cache;
        private readonly IAuthLogger _log;

        public TokenBlacklistService(IDistributedCache _cache, IAuthLogger log)
        {
            cache = _cache;
            _log = log;
        }

        public async Task<bool> IsTokenBlacklistedAsync(string token)
        {
            var tokenHash = HashToken(token);
            var cachedValue = await cache.GetStringAsync($"blacklist:{tokenHash}");

            var isBlacklisted = cachedValue != null;
            _log.Info($"BLACKLIST check | active={isBlacklisted}");

            return isBlacklisted;
        }

        public async Task AddToBlacklistAsync(string token, TimeSpan expiry)
        {
            var tokenHash = HashToken(token);
            await cache.SetStringAsync(
                $"blacklist:{tokenHash}",
                "revoked",
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = expiry }
            );

            _log.Info($"BLACKLIST add | len={token.Length} | expiry={expiry}");
        }

        private static string HashToken(string token)
        {
            using var sha256 = SHA256.Create();
            var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
            return Convert.ToBase64String(hashBytes);
        }
    }
}