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

        public long SignalFileSize { get; set; }

        /* имя файла в MinIO для NPY данных кодированное */
        public string SignalObjectName { get; set; }

        /* имя файла в MinIO для NPY данных изначальное */
        public string SignalOriginalFileName { get; set; }

        public DateTime SignalUploadedAt { get; set; } = DateTime.UtcNow;

        /* отношение 1 запись ко многим разметкам */
        public virtual ICollection<Markup> Markups { get; set; } = new List<Markup>();
    }
}
