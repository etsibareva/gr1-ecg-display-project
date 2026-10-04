using DataAccess.Data;
using DataAccess.Model;
using WebApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using static System.Runtime.InteropServices.JavaScript.JSType;
using WebApi.Logging;

/* (?) Разнести вспомогательные классы по файлам (?) */

namespace WebApi.Controllers
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
        private readonly IAuthLogger _log;

        public AuthController(
    AppDbContext _context,
    PasswordService _passwordService,
    JwtService _jwtService,
    RefreshTokenService _refreshTokenService,
    TokenBlacklistService _blacklistService,
    IAuthLogger log
)
        {
            context = _context;
            passwordService = _passwordService;
            jwtService = _jwtService;
            refreshTokenService = _refreshTokenService;
            blacklistService = _blacklistService;
            _log = log;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (await context.doctors.AnyAsync(u => u.Email == request.Email))
            {
                _log.Warn($"REGISTER fail | email={request.Email} | reason=already_exists");
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

            _log.Info($"REGISTER ok | id={doctor.IdDoctor} | login={doctor.Login} | email={doctor.Email}");

            return Ok(new { message = "User created successfully", userId = doctor.IdDoctor });
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
        {
            var doctor = await context.doctors.FirstOrDefaultAsync(u => u.Login == request.Login);

            if (doctor == null || !passwordService.VerifyPassword(request.Password, doctor.Password))
            {
                _log.Warn($"LOGIN fail | login={request.Login}");
                return Unauthorized(new { error = "Invalid credentials or user not found" });
            }

            var accessToken = jwtService.GenerateAccessToken(doctor);
            var refreshToken = await refreshTokenService.GenerateRefreshTokenAsync(doctor.IdDoctor);

            _log.Info($"LOGIN ok | id={doctor.IdDoctor} | login={doctor.Login}");

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
            {
                _log.Warn("REFRESH fail | reason=invalid_token");
                return Unauthorized(new { error = "Invalid refresh token" });
            }

            /* (?) Ротация каждые 24 часа или при подозрительной активности (?) */
            var shouldRotate = DateTime.UtcNow - tokenEntity.CreatedAt > TimeSpan.FromDays(1);

            string newRefreshToken = refreshToken;

            if (shouldRotate)
            {
                tokenEntity.IsRevoked = true;
                /* (?) await context.SaveChangesAsync(); повторно сохраняет токен (?) */

                newRefreshToken = await refreshTokenService.GenerateRefreshTokenAsync(tokenEntity.Doctor.IdDoctor);
                _log.Info($"REFRESH rotate | id={tokenEntity.Doctor.IdDoctor}");
            }

            var newAccessToken = jwtService.GenerateAccessToken(tokenEntity.Doctor);

            _log.Info($"REFRESH ok | id={tokenEntity.Doctor.IdDoctor}");

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
                _log.Warn("LOGOUT | reason=no_active_session");
                return Ok(new { message = "No active session" });
            }

            await blacklistService.AddToBlacklistAsync(accessToken, TimeSpan.FromMinutes(15));

            /* (?) Когда выходим - выходим из всех сессий (?) */
            await refreshTokenService.RevokeRefreshTokensAsync(userId);

            _log.Info($"LOGOUT ok | id={userId}");

            return Ok(new { message = "Logged out successfully" });
        }

        /* Endpoint для получения данных о враче. */
        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> GetCurrentUser()
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
            var doctor = await context.doctors.FindAsync(userId);

            if (doctor == null)
            {
                _log.Warn($"ME fail | id={userId} | reason=not_found");
                return NotFound("User not found");
            }

            _log.Info($"ME ok | id={userId}");

            return Ok(new
            {
                doctor.IdDoctor,
                doctor.FirstName,
                doctor.LastName,
                doctor.Patronym,
                doctor.Email,
                doctor.Login
            });
        }
    }
}