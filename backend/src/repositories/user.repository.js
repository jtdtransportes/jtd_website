import pool from "../config/db.js";

class UserRepository {
  async findByEmail(email) {
    const [rows] = await pool.execute(
      "SELECT * FROM Users WHERE email = ? LIMIT 1",
      [email]
    );
    return rows[0] || null;
  }

  async findByCpf(cpf) {
    const [rows] = await pool.execute(
      "SELECT * FROM Users WHERE cpf = ? LIMIT 1",
      [cpf]
    );
    return rows[0] || null;
  }

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT 
        id, nome, email, cpf, data_nascimento, sexo, telefone, role, is_active,
        last_login, created_at, updated_at
       FROM Users
       WHERE id = ?
       LIMIT 1`,
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
      `INSERT INTO Users
        (nome, email, password_hash, cpf, data_nascimento, sexo, telefone, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      "UPDATE Users SET last_login = NOW() WHERE id = ?",
      [id]
    );
  }



  async updateProfile(id, data) {
  const { nome, email, telefone, sexo, data_nascimento } = data;

  await pool.execute(
    `UPDATE Users
     SET nome = ?, email = ?, telefone = ?, sexo = ?, data_nascimento = ?
     WHERE id = ?`,
    [nome, email, telefone || null, sexo, data_nascimento, id]
  );

  return this.findById(id);
}

async deactivateAccount(id) {
  await pool.execute(
    `UPDATE Users
     SET is_active = 0
     WHERE id = ?`,
    [id]
  );
}

async findByEmailExcludingId(email, id) {
  const [rows] = await pool.execute(
    "SELECT * FROM Users WHERE email = ? AND id <> ? LIMIT 1",
    [email, id]
  );
  return rows[0] || null;
}
async findWithPasswordById(id) {
  const [rows] = await pool.execute(
    "SELECT * FROM Users WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

async updatePassword(id, passwordHash) {
  await pool.execute(
    `UPDATE Users
     SET password_hash = ?
     WHERE id = ?`,
    [passwordHash, id]
  );
}
async findAll() {
  const [rows] = await pool.execute(
    `SELECT id, nome
     FROM Users
     WHERE is_active = 1
     ORDER BY nome ASC`
  );

  return rows;
}
async findAllForAdmin() {
  const [rows] = await pool.execute(
    `SELECT id, nome, email, cpf, is_active
     FROM Users
     ORDER BY nome ASC`
  );

  return rows;
}
async adminDeactivateUser(userId) {
  await pool.execute(
    `UPDATE Users
     SET is_active = 0
     WHERE id = ?`,
    [userId]
  );
}


async adminActivateUser(userId) {
  await pool.execute(
    `UPDATE Users
     SET is_active = 1
     WHERE id = ?`,
    [userId]
  );
}





}








export default new UserRepository();