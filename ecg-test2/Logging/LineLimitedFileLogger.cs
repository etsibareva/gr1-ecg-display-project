using System.Text;

namespace WebApi.Logging;

public sealed class LineLimitedFileLogger
{
    private const int MaxLines = 1000;
    private readonly string _path;

    public LineLimitedFileLogger(string path)
    {
        _path = path;
    }

    public void Info(string message) => Write("INFO ", message);

    public void Warn(string message) => Write("WARN ", message);

    public void Error(string message) => Write("ERROR", message);

    public void Error(Exception ex, string message) =>
        Write("ERROR", $"{message} | ex={ex.GetType().Name}: {ex.Message}");

    private void Write(string level, string message)
    {
        var dir = Path.GetDirectoryName(_path);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);

        var line = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} | {level} | {message}";

        var lines = File.Exists(_path)
            ? File.ReadAllLines(_path).ToList()
            : new List<string>();

        if (lines.Count >= MaxLines)
            lines.Clear();

        lines.Add(line);
        File.WriteAllLines(_path, lines, Encoding.UTF8);
    }
}