using Microsoft.AspNetCore.Identity;

using DataAccess.Model;

namespace ecg_test2.Services
{
    public class PasswordService
    {
        private readonly PasswordHasher<Doctor> passwordHasher = new PasswordHasher<Doctor>();

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