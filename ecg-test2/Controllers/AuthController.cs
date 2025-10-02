using DataAccess.Data;
using DataAccess.Model;
using ecg_test2.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace ecg_test2.Controllers
{
    public class RegisterRequest
    {
        [Required] 
        [EmailAddress]
        public string Email { get; set; }

        [Required]
        public string Login { get; set; }

        [Required] 
        [MinLength(6)]
        public string Password { get; set; }

        [Required]
        public string FirstName { get; set; }

        [Required]
        public string LastName { get; set; }

        public string Patronym { get; set; }
    }

    public class LoginRequest
    {
        [Required]
        public string Login { get; set; }

        [Required]
        [MinLength(6)]
        public string Password { get; set; }
    }

    public class AuthResponse
    {
        public string AccessToken { get; set; }
        public string RefreshToken { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext context;
        private readonly PasswordService passwordService;
        private readonly JwtService jwtService;
        private readonly RefreshTokenService refreshTokenService;
        private readonly TokenBlacklistService blacklistService;

        public AuthController(
        AppDbContext _context,
        PasswordService _passwordService,
        JwtService _jwtService,
        RefreshTokenService _refreshTokenService,
        TokenBlacklistService _blacklistService
        )
        {
            context = _context;
            passwordService = _passwordService;
            jwtService = _jwtService;
            refreshTokenService = _refreshTokenService;
            blacklistService = _blacklistService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (await context.doctors.AnyAsync(u => u.Email == request.Email))
            {
                return BadRequest(new { error = "User already exists" });
            }

            var passwordHash = passwordService.HashPassword(request.Password);
            
            var doctor = new Doctor
            {
                Email = request.Email,
                Login = request.Login,
                Password = passwordHash,
                FirstName = request.FirstName,
                LastName = request.LastName,
                Patronym = request.Patronym
            };

            context.doctors.Add(doctor);
            await context.SaveChangesAsync();

            return Ok(new { message = "User created successfully", userId = doctor.IdDoctor });
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
        {
            var doctor = await context.doctors.FirstOrDefaultAsync(u => u.Login == request.Login);

            if (doctor == null || !passwordService.VerifyPassword(request.Password, doctor.Password))
            {
                return Unauthorized(new { error = "Invalid credentials or user not found" });
            }

            var accessToken = jwtService.GenerateAccessToken(doctor);
            var refreshToken = await refreshTokenService.GenerateRefreshTokenAsync(doctor.IdDoctor);

            var response = new AuthResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken
            };

            return Ok(response);
        }

        [HttpPost("refresh")]
        public async Task<ActionResult<AuthResponse>> Refresh([FromBody] string refreshToken)
        {
            var tokenEntity = await refreshTokenService.VerifyRefreshTokenAsync(refreshToken);

            if (tokenEntity == null)
                return Unauthorized(new { error = "Invalid refresh token" });

            // Ротация каждые 24 часа или при подозрительной активности (?)
            var shouldRotate = DateTime.UtcNow - tokenEntity.CreatedAt > TimeSpan.FromDays(1);

            string newRefreshToken = refreshToken;

            if (shouldRotate)
            {
                tokenEntity.IsRevoked = true;
                //await context.SaveChangesAsync(); повторно сохраняет токен (?)
                
                newRefreshToken = await refreshTokenService.GenerateRefreshTokenAsync(tokenEntity.Doctor.IdDoctor);
            }

            var newAccessToken = jwtService.GenerateAccessToken(tokenEntity.Doctor);

            return new AuthResponse
            {
                AccessToken = newAccessToken,
                RefreshToken = newRefreshToken
            };
        }

        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            var accessToken = HttpContext.Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

            if (string.IsNullOrEmpty(accessToken) || string.IsNullOrEmpty(userId.ToString()))
            {
                return Ok(new { message = "No active session" });
            }

            await blacklistService.AddToBlacklistAsync(accessToken, TimeSpan.FromMinutes(15));

            await refreshTokenService.RevokeRefreshTokensAsync(userId); // когда выходим - выходим из всех сессий! (?)

            return Ok(new { message = "Logged out successfully" });
        }
    }
}
