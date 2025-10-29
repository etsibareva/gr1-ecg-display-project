using Microsoft.AspNetCore.Identity;

using DataAccess.Model;

namespace WebApi.Services
{
    public class PasswordService
    {
        private readonly PasswordHasher<Doctor> passwordHasher = new PasswordHasher<Doctor>();

        /* (!) Ввести использование SALT для хеширования паролей (!) */
        public string HashPassword(string password)
        {
            return passwordHasher.HashPassword(null, password);
        }

        public bool VerifyPassword(string password, string passwordHash)
        {
            var result = passwordHasher.VerifyHashedPassword(null, passwordHash, password);
            return result == PasswordVerificationResult.Success;
        }
    }
}