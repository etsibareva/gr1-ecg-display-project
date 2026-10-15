namespace WebApi.Logging;

public interface IAuthLogger
{
    void Info(string message);
    void Warn(string message);
    void Error(Exception ex, string message);
    void Error(string message);
}