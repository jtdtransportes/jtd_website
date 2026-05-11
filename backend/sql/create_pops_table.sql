CREATE TABLE IF NOT EXISTS pops (
  id INT NOT NULL AUTO_INCREMENT,
  sector_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  drive_file_id VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_pops_sector_active (sector_id, is_active),
  KEY idx_pops_drive_file_id (drive_file_id),
  KEY idx_pops_created_by (created_by),
  CONSTRAINT fk_pops_sector
    FOREIGN KEY (sector_id)
    REFERENCES sectors (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_pops_created_by
    FOREIGN KEY (created_by)
    REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
