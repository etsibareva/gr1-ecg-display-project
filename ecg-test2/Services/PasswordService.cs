using Microsoft.AspNetCore.Identity;

using DataAccess.Model;
using WebApi.Logging;

namespace WebApi.Services
{
    public class PasswordService
    {
        private readonly PasswordHasher<Doctor> passwordHasher = new PasswordHasher<Doctor>();
        private readonly IAuthLogger _log;
        private readonly string _pepper;

        public PasswordService(IAuthLogger log)
        {
            _log = log;
            _pepper = Environment.GetEnvironmentVariable("PASSWORD_PEPPER");
            if (string.IsNullOrEmpty(_pepper))
            {
                _log.Error("PASSWORD_PEPPER not found in environment variables");
                throw new InvalidOperationException("PASSWORD_PEPPER not found in environment variables");
            }
        }

        /* (!) Ввести использование SALT для хеширования паролей (!) */
        public string HashPassword(string password)
        {
            try
            {
                var peppered = password + _pepper;
                var hash = passwordHasher.HashPassword(null, peppered);
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
            var peppered = password + _pepper;
            var result = passwordHasher.VerifyHashedPassword(null, passwordHash, peppered);

            if (result == PasswordVerificationResult.Success)
                _log.Info("PASSWORD verify ok");
            else
                _log.Warn($"PASSWORD verify fail | result={result}");

            return result == PasswordVerificationResult.Success;
        }
    }
}