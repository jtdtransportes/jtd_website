import pool from "../config/db.js";

class ContrachequeRepository {
  async create(data) {
    const {
      user_id,
      mes,
      ano,
      file_name,
      original_name,
      drive_file_id,
      mime_type,
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO contracheques
        (user_id, mes, ano, file_name, original_name, drive_file_id, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, mes, ano, file_name, original_name, drive_file_id, mime_type]
    );

    return this.findById(result.insertId);
  }

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT
        id,
        user_id,
        mes,
        ano,
        file_name,
        original_name,
        drive_file_id,
        mime_type,
        created_at,
        is_active
       FROM contracheques
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0] || null;
  }

  async findByIdAndUserId(id, userId) {
    const [rows] = await pool.execute(
      `SELECT
        id,
        user_id,
        mes,
        ano,
        file_name,
        original_name,
        drive_file_id,
        mime_type,
        created_at,
        is_active
       FROM contracheques
       WHERE id = ? AND user_id = ? AND is_active = 1
       LIMIT 1`,
      [id, userId]
    );

    return rows[0] || null;
  }

  async deactivate(id, userId) {
    await pool.execute(
      `UPDATE contracheques
       SET is_active = 0
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
  }

  async findAllByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT
        id,
        user_id,
        mes,
        ano,
        file_name,
        original_name,
        drive_file_id,
        mime_type,
        created_at,
        is_active
       FROM contracheques
       WHERE user_id = ? AND is_active = 1
       ORDER BY ano DESC, mes DESC, created_at DESC`,
      [userId]
    );

    return rows;
  }

  async findAllDetailed() {
    const [rows] = await pool.execute(
      `SELECT
        c.id,
        c.user_id,
        c.mes,
        c.ano,
        c.file_name,
        c.original_name,
        c.drive_file_id,
        c.mime_type,
        c.created_at,
        c.is_active,
        u.nome AS user_nome,
        u.email AS user_email,
        u.cpf AS user_cpf
       FROM contracheques c
       INNER JOIN users u ON u.id = c.user_id
       ORDER BY u.nome ASC, c.ano DESC, c.mes DESC, c.created_at DESC`
    );

    return rows;
  }

  async deleteById(id) {
    await pool.execute(
      `DELETE FROM contracheques
       WHERE id = ?`,
      [id]
    );
  }
}

export default new ContrachequeRepository();