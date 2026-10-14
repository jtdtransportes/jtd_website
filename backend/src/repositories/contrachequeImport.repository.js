import pool from "../config/db.js";
import { normalizeImportCpf } from "../services/contrachequeImport.service.js";

const CPF_DIGITS = "REGEXP_REPLACE(TRIM(CAST(u.cpf AS CHAR)), '[^0-9]', '')";

export class ContrachequeImportRepository {
  constructor(database = pool) { this.database = database; }

  async matchUsers(cpfs, { mes, ano }) {
    const [rows] = await this.database.execute(
      `SELECT u.id, u.nome, u.cpf, c.id AS paycheck_id, c.is_active AS paycheck_active
       FROM users u
       LEFT JOIN contracheques c ON c.user_id = u.id AND c.mes = ? AND c.ano = ?
       WHERE LENGTH(${CPF_DIGITS}) BETWEEN 1 AND 11
         AND LPAD(${CPF_DIGITS}, 11, '0') IN (${cpfs.map(() => "?").join(",")})`,
      [mes, ano, ...cpfs]
    );
    return rows;
  }

  async saveImport({ userId, cpf, mes, ano, name, driveId }) {
    const connection = await this.database.getConnection();
    let commitStarted = false;
    try {
      await connection.beginTransaction();
      // Serializa importações simultâneas do mesmo usuário, inclusive sem contracheque prévio.
      const [[user]] = await connection.execute("SELECT id, cpf FROM users WHERE id = ? FOR UPDATE", [userId]);
      if (!user || normalizeImportCpf(user.cpf) !== cpf) throw new Error("CPF do usuário alterado.");
      const [[existing]] = await connection.execute(
        "SELECT id, is_active FROM contracheques WHERE user_id = ? AND mes = ? AND ano = ? FOR UPDATE",
        [userId, mes, ano]
      );
      if (Number(existing?.is_active) === 1) {
        await connection.rollback();
        return { status: "existing", message: "Já importado nesta competência. Nenhuma duplicidade criada." };
      }
      if (existing) {
        await connection.execute(
          `UPDATE contracheques SET file_name = ?, original_name = ?, drive_file_id = ?,
           mime_type = 'application/pdf', file_path = NULL, created_at = NOW(), is_active = 1 WHERE id = ?`,
          [name, name, driveId, existing.id]
        );
      } else {
        await connection.execute(
          `INSERT INTO contracheques
           (user_id, mes, ano, file_name, original_name, drive_file_id, mime_type, file_path, created_at, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 'application/pdf', NULL, NOW(), 1)`,
          [userId, mes, ano, name, name, driveId]
        );
      }
      commitStarted = true;
      await connection.commit();
      return { status: "imported", message: existing ? "Contracheque reativado com sucesso." : "Contracheque importado com sucesso." };
    } catch (error) {
      if (commitStarted) error.commitUncertain = true;
      try { await connection.rollback(); } catch { /* Preservar o erro original. */ }
      throw error;
    } finally { connection.release(); }
  }
}

export default new ContrachequeImportRepository();
