using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace DataAccess.Model
{
    public class RefreshToken
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int IdRefreshToken { get; set; }

        [Required]
        public int IdDoctor { get; set; }

        [Required]
        public string TokenHash { get; set; }

        [Required]
        [Column(TypeName = "timestamp with time zone")]
        public DateTime ExpiresAt { get; set; }

        [Required]
        [Column(TypeName = "timestamp with time zone")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /* Признак "отозван" */
        [Required]
        public bool IsRevoked { get; set; }

        [ForeignKey("IdDoctor")]
        public virtual Doctor Doctor { get; set; }
    }
}
