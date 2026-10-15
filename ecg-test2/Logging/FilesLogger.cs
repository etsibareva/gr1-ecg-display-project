namespace WebApi.Logging;

public sealed class FilesLogger : IFilesLogger
{
    private readonly LineLimitedFileLogger _logger = new("logs/files.log");

    public void Info(string message) => _logger.Info(message);
    public void Warn(string message) => _logger.Warn(message);
    public void Error(string message) => _logger.Error(message);
    public void Error(Exception ex, string message) => _logger.Error(ex, message);
}