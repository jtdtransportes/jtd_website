import pool from "../config/db.js";

class PopRepository {
  async sectorExists(sectorId) {
    const [rows] = await pool.execute(
      "SELECT id FROM sectors WHERE id = ? LIMIT 1",
      [sectorId]
    );

    return Boolean(rows[0]);
  }

  async create(data) {
    const {
      sector_id,
      title,
      file_name,
      original_name,
      drive_file_id,
      mime_type,
      created_by,
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO pops
        (sector_id, title, file_name, original_name, drive_file_id, mime_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sector_id,
        title,
        file_name,
        original_name,
        drive_file_id,
        mime_type,
        created_by || null,
      ]
    );

    return this.findById(result.insertId);
  }

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT
        p.id,
        p.sector_id,
        p.title,
        p.file_name,
        p.original_name,
        p.drive_file_id,
        p.mime_type,
        p.created_by,
        p.created_at,
        p.updated_at,
        p.is_active,
        s.name AS sector_name,
        u.nome AS created_by_name
       FROM pops p
       INNER JOIN sectors s ON s.id = p.sector_id
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0] || null;
  }

  async findActivePrioritizingSector({
    sectorId,
    isMotoristaUser,
    motoristaSectorId,
  }) {
    const motoristaUserFlag = isMotoristaUser ? 1 : 0;

    const [rows] = await pool.execute(
      `SELECT
        p.id,
        p.sector_id,
        p.title,
        p.file_name,
        p.original_name,
        p.drive_file_id,
        p.mime_type,
        p.created_by,
        p.created_at,
        p.updated_at,
        p.is_active,
        s.name AS sector_name,
        u.nome AS created_by_name
       FROM pops p
       INNER JOIN sectors s ON s.id = p.sector_id
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.is_active = 1
        AND (
          (? = 1 AND (p.sector_id = ? OR LOWER(TRIM(s.name)) = 'motorista'))
          OR
          (? = 0 AND p.sector_id <> ? AND LOWER(TRIM(s.name)) <> 'motorista')
        )
       ORDER BY
        CASE WHEN p.sector_id = ? THEN 0 ELSE 1 END,
        s.name ASC,
        p.title ASC,
        p.created_at DESC`,
      [
        motoristaUserFlag,
        motoristaSectorId,
        motoristaUserFlag,
        motoristaSectorId,
        sectorId || null,
      ]
    );

    return rows;
  }

  async findAllDetailed() {
    const [rows] = await pool.execute(
      `SELECT
        p.id,
        p.sector_id,
        p.title,
        p.file_name,
        p.original_name,
        p.drive_file_id,
        p.mime_type,
        p.created_by,
        p.created_at,
        p.updated_at,
        p.is_active,
        s.name AS sector_name,
        u.nome AS created_by_name
       FROM pops p
       INNER JOIN sectors s ON s.id = p.sector_id
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.is_active = 1
       ORDER BY s.name ASC, p.title ASC, p.created_at DESC`
    );

    return rows;
  }

  async deleteById(id) {
    await pool.execute("DELETE FROM pops WHERE id = ?", [id]);
  }
}

export default new PopRepository();
