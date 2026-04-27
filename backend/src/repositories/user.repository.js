import pool from "../config/db.js";

class UserRepository {
  async findByEmail(email) {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    return rows[0] || null;
  }

  async findByCpf(cpf) {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE cpf = ? LIMIT 1",
      [cpf]
    );

    return rows[0] || null;
  }

  async findById(id) {
    const [rows] = await pool.execute(
      `
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.cpf,
        u.data_nascimento,
        u.sexo,
        u.telefone,
        u.role,
        u.is_active,
        u.last_login,
        u.created_at,
        u.updated_at,
        u.sector_id,
        s.name AS sector_name
      FROM users u
      LEFT JOIN sectors s ON s.id = u.sector_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }

  async create(data) {
    const {
      nome,
      email,
      password_hash,
      cpf,
      data_nascimento,
      sexo,
      telefone,
      role,
      is_active,
    } = data;

    const [result] = await pool.execute(
      `
      INSERT INTO users
        (nome, email, password_hash, cpf, data_nascimento, sexo, telefone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nome,
        email,
        password_hash,
        cpf,
        data_nascimento,
        sexo,
        telefone || null,
        role || "user",
        is_active ?? 1,
      ]
    );

    return this.findById(result.insertId);
  }

  async updateLastLogin(id) {
    await pool.execute(
      "UPDATE users SET last_login = NOW() WHERE id = ?",
      [id]
    );
  }

  async updateProfile(id, data) {
    const { nome, email, telefone, sexo, data_nascimento } = data;

    await pool.execute(
      `
      UPDATE users
      SET nome = ?, email = ?, telefone = ?, sexo = ?, data_nascimento = ?
      WHERE id = ?
      `,
      [nome, email, telefone || null, sexo, data_nascimento, id]
    );

    return this.findById(id);
  }

  async deactivateAccount(id) {
    await pool.execute(
      `
      UPDATE users
      SET is_active = 0
      WHERE id = ?
      `,
      [id]
    );
  }

  async findByEmailExcludingId(email, id) {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE email = ? AND id <> ? LIMIT 1",
      [email, id]
    );

    return rows[0] || null;
  }

  async findWithPasswordById(id) {
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE id = ? LIMIT 1",
      [id]
    );

    return rows[0] || null;
  }

  async updatePassword(id, passwordHash) {
    await pool.execute(
      `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
      `,
      [passwordHash, id]
    );
  }

  async findAll() {
    const [rows] = await pool.execute(
      `
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.cpf,
        u.is_active,
        u.sector_id,
        s.name AS sector_name
      FROM users u
      LEFT JOIN sectors s ON s.id = u.sector_id
      WHERE u.is_active = 1
      ORDER BY u.nome ASC
      `
    );

    return rows;
  }

  async findAllForAdmin() {
    const [rows] = await pool.execute(
      `
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.cpf,
        u.is_active,
        u.sector_id,
        s.name AS sector_name
      FROM users u
      LEFT JOIN sectors s ON s.id = u.sector_id
      ORDER BY u.nome ASC
      `
    );

    return rows;
  }

  async adminDeactivateUser(userId) {
    await pool.execute(
      `
      UPDATE users
      SET is_active = 0
      WHERE id = ?
      `,
      [userId]
    );
  }

  async adminActivateUser(userId) {
    await pool.execute(
      `
      UPDATE users
      SET is_active = 1
      WHERE id = ?
      `,
      [userId]
    );
  }

  async findByEmailOrCpf(login) {
    const loginLimpo = String(login || "").trim().toLowerCase();
    const cpfLimpo = String(login || "").replace(/\D/g, "");

    const [rows] = await pool.execute(
      `
      SELECT *
      FROM users
      WHERE LOWER(email) = ?
         OR REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?
      LIMIT 1
      `,
      [loginLimpo, cpfLimpo]
    );

    return rows[0] || null;
  }
}

export default new UserRepository();