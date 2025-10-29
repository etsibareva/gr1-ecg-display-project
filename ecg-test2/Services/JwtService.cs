using Microsoft.Extensions.Configuration;
using System.Security.Claims;
using System.Text;

using DataAccess.Model;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;

namespace WebApi.Services
{
    public class JwtService
    {
        private readonly IConfiguration configuration;

        public JwtService(IConfiguration _configuration)
        {
            configuration = _configuration;
        }

        public string GenerateAccessToken(Doctor doctor)
        {
            //return GenerateToken(doctor, true);
            return GenerateToken(doctor);
        }

        /* 
         * (?) Ранее GenerateToken работала и для создания Refresh-токенов,
         *     однако я отказалась от шифрования и оставила только их хеширование 
         * (?) 
         */

        /* (!) Для Refresh-токенов SALT для хеширования ввести (!) */

        /* (!) Привести к одному формату либо четко определить: что находится в конфигурации, что в ENV. (!) */
        private string GenerateToken(Doctor doctor)
        {
            var jwtConfig = configuration.GetSection("Jwt");

            var secret = Environment.GetEnvironmentVariable("JWT_SECRET"); 
            var expiryMinutes = int.Parse(jwtConfig["AccessExpiryMinutes"]);

            var key = Encoding.ASCII.GetBytes(secret);
            var tokenHandler = new JwtSecurityTokenHandler();

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                new Claim(ClaimTypes.NameIdentifier, doctor.IdDoctor.ToString()),
                new Claim(ClaimTypes.Name, doctor.Login),
                new Claim(ClaimTypes.Email, doctor.Email),
                new Claim("token_type", "access")
            }),
                Expires = DateTime.UtcNow.AddMinutes(expiryMinutes),
                Issuer = jwtConfig["Issuer"],
                Audience = jwtConfig["Audience"],
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}