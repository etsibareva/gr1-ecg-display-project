using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DataAccess.Model
{
    public class Record
    {
        [Key]
        [Required]
        public int IdRecord { get; set; }

        [Required]
        public int IdDoctor { get; set; }

        [ForeignKey("IdDoctor")]
        public virtual Doctor Doctor { get; set; }

        /* предположено в Hz */
        public int RC { get; set; }

        public int Type { get; set; }

        /* имя файла в MinIO для NPY данных */
        public string SignalObjectName { get; set; }

        public int IdMarkup { get; set; }

        /* Возможно изменение при переходе Markup на MinIO хранилище. */
        [ForeignKey("IdMarkup")]
        public virtual Markup Markup { get; set; }

        public long SignalFileSize { get; set; }

        public DateTime SignalUploadedAt { get; set; } = DateTime.UtcNow;

        public string SignalOriginalFileName { get; set; } = string.Empty;
    }
}
