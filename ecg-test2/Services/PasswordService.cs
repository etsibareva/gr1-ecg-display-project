using Microsoft.AspNetCore.Identity;

using DataAccess.Model;
using WebApi.Logging;

namespace WebApi.Services
{
    public class PasswordService
    {
        private readonly PasswordHasher<Doctor> passwordHasher = new PasswordHasher<Doctor>();
        private readonly IAuthLogger _log;

        public PasswordService(IAuthLogger log)
        {
            _log = log;
        }

        /* (!) Ввести использование SALT для хеширования паролей (!) */
        public string HashPassword(string password)
        {
            try
            {
                var hash = passwordHasher.HashPassword(null, password);
                _log.Info("PASSWORD hash ok");
                return hash;
            }
            catch (Exception ex)
            {
                _log.Error(ex, "PASSWORD hash fail");
                throw;
            }
        }

        public bool VerifyPassword(string password, string passwordHash)
        {
            var result = passwordHasher.VerifyHashedPassword(null, passwordHash, password);

            if (result == PasswordVerificationResult.Success)
                _log.Info("PASSWORD verify ok");
            else
                _log.Warn($"PASSWORD verify fail | result={result}");

            return result == PasswordVerificationResult.Success;
        }
    }
}