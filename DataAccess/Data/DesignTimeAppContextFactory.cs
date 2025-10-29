using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

using DotNetEnv;

namespace DataAccess.Data
{
    public class DesignTimeAppContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        
        public AppDbContext CreateDbContext(string[] args)
        {
            Env.Load();

            /* (!) Убрать все значения по умолчанию. Тестировать. (!) */
            var dbHost = Environment.GetEnvironmentVariable("POSTGRES_HOST") ?? "localhost";
            var dbName = Environment.GetEnvironmentVariable("POSTGRES_DB") ?? "EcgDb";
            var dbUser = Environment.GetEnvironmentVariable("POSTGRES_USER") ?? "postgres";
            var dbPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD");
            var connectionString = $"Host={dbHost};Port=5432;Database={dbName};Username={dbUser};Password={dbPassword}";

            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            optionsBuilder.UseNpgsql(connectionString);

            return new AppDbContext(optionsBuilder.Options);
        }
    }
}
