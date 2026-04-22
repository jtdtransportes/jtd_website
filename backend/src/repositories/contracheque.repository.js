import pool from "../config/db.js";

class ContrachequeRepository {
  async create(data) {
    const { user_id, mes, ano, file_name, original_name, file_path } = data;

    const [result] = await pool.execute(
      `INSERT INTO contracheques
        (user_id, mes, ano, file_name, original_name, file_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, mes, ano, file_name, original_name, file_path]
    );

    return this.findById(result.insertId);
  }

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT 
        id, user_id, mes, ano, file_name, original_name, file_path, created_at, is_active
       FROM contracheques
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0] || null;
  }

  async updateFileData(id, file_name, file_path) {
    await pool.execute(
      `UPDATE contracheques
       SET file_name = ?, file_path = ?
       WHERE id = ?`,
      [file_name, file_path, id]
    );

    return this.findById(id);
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
      file_path,
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
      c.file_path,
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

async findById(id) {
  const [rows] = await pool.execute(
    `SELECT
      id,
      user_id,
      mes,
      ano,
      file_name,
      original_name,
      file_path,
      created_at,
      is_active
     FROM contracheques
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
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