using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
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

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /* имя файла в MinIO для JSON разметки кодированное */
        public string? MarkupObjectName { get; set; }

        public long? MarkupFileSize { get; set; }

        /* имя файла в MinIO для JSON разметки кодированное */
        public string? MarkupOriginalFileName { get; set; }

        public DateTime? MarkupUploadedAt { get; set; }

        /* к какой записи относится */
        public int IdRecord { get; set; }

        [ForeignKey("IdRecord")]
        public virtual Record Record { get; set; }
    }
}