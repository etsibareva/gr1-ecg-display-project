using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DataAccess.Model
{
    public class Markup
    {
        [Key]
        [Required]
        public int IdMarkup { get; set; }

        /* Сменить на хранилище MinIO */
        [Required]
        public string JsonData { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public virtual ICollection<Record> Records { get; set; } = new List<Record>();
    }
}
