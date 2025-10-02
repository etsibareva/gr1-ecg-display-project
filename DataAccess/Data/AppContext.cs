using DataAccess.Model;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.Emit;
using System.Text;
using System.Threading.Tasks;

namespace DataAccess.Data
{
    public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
    {
        public DbSet<Doctor> doctors { get; set; }
        public DbSet<RefreshToken> refreshTokens { get; set; }
        public DbSet<Markup> markups { get; set; }
        public DbSet<Record> records { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<RefreshToken>(entity =>
            {
                entity.HasKey(rt => rt.IdRefreshToken);

                entity.HasOne(rt => rt.Doctor)
                      .WithMany(u => u.RefreshTokens)
                      .HasForeignKey(rt => rt.IdDoctor)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Doctor>(entity =>
            {
                entity.HasKey(u => u.IdDoctor);
                entity.HasIndex(u => u.Email).IsUnique();
            });

             modelBuilder.Entity<Markup>(entity =>
             {
                 entity.HasKey(m => m.IdMarkup);
                 entity.Property(m => m.JsonData)
                       .IsRequired()
                       .HasColumnType("jsonb");

                 // ещё индексы для скорости поиска (?)

                 // GIN индекс для быстрого поиска по JSON
                 entity.HasIndex(m => m.JsonData)
                       .HasMethod("GIN");
             });

            modelBuilder.Entity<Record>(entity =>
            {
                entity.HasKey(r => r.IdRecord);

                entity.HasOne(r => r.Doctor)
                      .WithMany()
                      .HasForeignKey(r => r.IdDoctor)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(r => r.Markup)
                      .WithMany(m => m.Records)
                      .HasForeignKey(r => r.IdMarkup)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            base.OnModelCreating(modelBuilder);
        }
    }
}
