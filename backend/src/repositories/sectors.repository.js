import pool from "../config/db.js";

export async function findAllSectors() {
  const [rows] = await pool.query(`
    SELECT 
      id,
      name AS name,
      created_at,
      updated_at
    FROM sectors
    ORDER BY name ASC
  `);

  return rows;
}

export async function insertSector(data) {
  const [result] = await pool.query(
    `
      INSERT INTO sectors (name)
      VALUES (?)
    `,
    [data.descricao]
  );

  const [rows] = await pool.query(
    `
      SELECT 
        id,
        name AS name,
        created_at,
        updated_at
      FROM sectors
      WHERE id = ?
    `,
    [result.insertId]
  );

  return rows[0];
}

export async function updateSector(id, data) {
  const [result] = await pool.query(
    `
      UPDATE sectors
      SET name = ?
      WHERE id = ?
    `,
    [data.descricao, id]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT 
        id,
        name AS name,
        created_at,
        updated_at
      FROM sectors
      WHERE id = ?
    `,
    [id]
  );

  return rows[0];
}

export async function deleteSector(id) {
  const [result] = await pool.query(
    `
      DELETE FROM sectors
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows > 0;
}

export async function findAllUsersWithSectors() {
  const [rows] = await pool.query(`
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
    ORDER BY u.nome ASC
  `);

  return rows;
}

export async function updateUserSector(userId, sectorId) {
  const normalizedSectorId =
    sectorId === "" || sectorId === null || sectorId === undefined
      ? null
      : Number(sectorId);

  const [result] = await pool.query(
    `
      UPDATE users
      SET sector_id = ?
      WHERE id = ?
    `,
    [normalizedSectorId, userId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
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
    `,
    [userId]
  );

  return rows[0];
}