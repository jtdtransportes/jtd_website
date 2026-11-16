// Repositório do "Comunicar reajuste": cadastro de contatos dos clientes (reaproveita antt_clientes) e histórico
// de comunicados. O histórico é imutável: não existe método para alterar conteúdo, só o status do provedor.
import pool from "../config/db.js";

const ts = (col, alias = col) => `DATE_FORMAT(${col}, '%Y-%m-%dT%H:%i:%s') AS ${alias}`;
const json = (v, fb) => {
  if (v == null) return fb;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return fb; }
};

async function inTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

const CLIENTE_COLS = `c.id, c.nome, cc.email_principal, cc.contato_nome, cc.emails_cc, cc.observacoes,
  COALESCE(cc.ativo, 1) AS ativo, (cc.cliente_id IS NOT NULL) AS tem_cadastro, ${ts("cc.atualizado_em", "atualizado_em")}`;
const mapCliente = (r) => r && ({
  id: r.id, nome: r.nome, email_principal: r.email_principal || null, contato_nome: r.contato_nome || null,
  emails_cc: json(r.emails_cc, []), observacoes: r.observacoes || null, ativo: Boolean(Number(r.ativo)),
  tem_cadastro: Boolean(Number(r.tem_cadastro)), atualizado_em: r.atualizado_em || null,
});
const mapComunicado = (r) => r && ({
  ...r, cc: json(r.cc, []), anexos: json(r.anexos, []), percentual: r.percentual == null ? null : String(r.percentual),
});

class AnttComunicadosRepository {
  // ------------------------------------------------------------ clientes
  /** Clientes do módulo (exceto excluídos). Os que ainda não têm e-mail aparecem para completar o cadastro. */
  async listarClientes({ busca = "", incluirInativos = true } = {}) {
    const where = ["cc.excluido_em IS NULL"];
    const params = [];
    if (!incluirInativos) where.push("cc.ativo = 1", "cc.email_principal IS NOT NULL");
    if (busca) {
      where.push("(c.nome LIKE ? OR cc.email_principal LIKE ? OR cc.contato_nome LIKE ?)");
      const b = `%${busca.replace(/[\\%_]/g, (x) => `\\${x}`)}%`;
      params.push(b, b, b);
    }
    const [rows] = await pool.execute(
      `SELECT ${CLIENTE_COLS} FROM antt_clientes c LEFT JOIN antt_clientes_comunicacao cc ON cc.cliente_id = c.id
       WHERE ${where.join(" AND ")} ORDER BY c.nome LIMIT 1000`, params);
    return rows.map(mapCliente);
  }

  /** Cliente para envio/edição (null se não existe ou foi excluído). */
  async clientePorId(id) {
    const [rows] = await pool.execute(
      `SELECT ${CLIENTE_COLS} FROM antt_clientes c LEFT JOIN antt_clientes_comunicacao cc ON cc.cliente_id = c.id
       WHERE c.id = ? AND cc.excluido_em IS NULL LIMIT 1`, [id]);
    return mapCliente(rows[0]) || null;
  }

  /**
   * Cadastra. Se já existe um cliente do módulo com o mesmo nome (ex.: criado nos retroativos) ou um excluído,
   * o registro é REAPROVEITADO (sem duplicar antt_clientes). Conflito real → erro com code "DUPLICADO".
   */
  async criarCliente(dados, usuarioId) {
    return inTransaction(async (cx) => {
      const [ex] = await cx.execute(
        `SELECT c.id, cc.cliente_id AS ext, cc.excluido_em FROM antt_clientes c
         LEFT JOIN antt_clientes_comunicacao cc ON cc.cliente_id = c.id WHERE c.nome = ? LIMIT 1 FOR UPDATE`, [dados.nome]);
      let id; let reaproveitado = false;
      if (ex[0]) {
        if (ex[0].ext != null && ex[0].excluido_em == null) throw Object.assign(new Error("duplicado"), { code: "DUPLICADO" });
        id = ex[0].id; reaproveitado = true;
        await cx.execute("UPDATE antt_clientes SET nome = ? WHERE id = ?", [dados.nome, id]);
      } else {
        const [r] = await cx.execute("INSERT INTO antt_clientes (nome, criado_por) VALUES (?, ?)", [dados.nome, usuarioId || null]);
        id = r.insertId;
      }
      await this.#gravarExtensao(cx, id, dados, usuarioId);
      return { id, reaproveitado };
    });
  }

  async atualizarCliente(id, dados, usuarioId) {
    return inTransaction(async (cx) => {
      const [ex] = await cx.execute(
        `SELECT c.id FROM antt_clientes c LEFT JOIN antt_clientes_comunicacao cc ON cc.cliente_id = c.id
         WHERE c.id = ? AND cc.excluido_em IS NULL LIMIT 1 FOR UPDATE`, [id]);
      if (!ex[0]) return false;
      await cx.execute("UPDATE antt_clientes SET nome = ? WHERE id = ?", [dados.nome, id]);
      await this.#gravarExtensao(cx, id, dados, usuarioId);
      return true;
    });
  }

  async #gravarExtensao(cx, id, d, usuarioId) {
    await cx.execute(
      `INSERT INTO antt_clientes_comunicacao (cliente_id, email_principal, contato_nome, emails_cc, observacoes, ativo, excluido_em, excluido_por, atualizado_por)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)
       ON DUPLICATE KEY UPDATE email_principal = VALUES(email_principal), contato_nome = VALUES(contato_nome), emails_cc = VALUES(emails_cc),
         observacoes = VALUES(observacoes), ativo = VALUES(ativo), excluido_em = NULL, excluido_por = NULL, atualizado_por = VALUES(atualizado_por)`,
      [id, d.email_principal, d.contato_nome || null, JSON.stringify(d.emails_cc || []), d.observacoes || null, d.ativo ? 1 : 0, usuarioId || null]);
  }

  /** Exclusão lógica: some das listas, histórico e antt_clientes (fretes/retroativos) preservados. */
  async excluirCliente(id, usuarioId) {
    const [r] = await pool.execute(
      `INSERT INTO antt_clientes_comunicacao (cliente_id, ativo, excluido_em, excluido_por, atualizado_por)
       SELECT c.id, 0, CURRENT_TIMESTAMP, ?, ? FROM antt_clientes c WHERE c.id = ?
       ON DUPLICATE KEY UPDATE ativo = 0, excluido_em = COALESCE(excluido_em, CURRENT_TIMESTAMP), excluido_por = VALUES(excluido_por)`,
      [usuarioId || null, usuarioId || null, id]);
    return r.affectedRows > 0;
  }

  async usuario(id) {
    const [rows] = await pool.execute("SELECT id, nome, email FROM users WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  // ------------------------------------------------------------ comunicados (imutáveis)
  /** Grava o comunicado ANTES do envio (status ENVIANDO). chave_envio repetida → ER_DUP_ENTRY. */
  async criarComunicado(c) {
    const [r] = await pool.execute(
      `INSERT INTO antt_comunicados (chave_envio, modo, cliente_id, cliente_nome, destinatario, cc, remetente, reply_to, assunto,
         corpo_html, email_html, email_texto, conteudo_sha256, percentual, data_vigencia, contrato_ref, anexos, status, enviado_por, enviado_por_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENVIANDO', ?, ?)`,
      [c.chave_envio, c.modo, c.cliente_id ?? null, c.cliente_nome, c.destinatario, JSON.stringify(c.cc || []), c.remetente, c.reply_to || null,
        c.assunto, c.corpo_html, c.email_html, c.email_texto, c.conteudo_sha256, c.percentual ?? null, c.data_vigencia || null,
        c.contrato_ref || null, JSON.stringify(c.anexos || []), c.enviado_por ?? null, c.enviado_por_nome || null]);
    return r.insertId;
  }

  /** Só campos de status/provedor. */
  async atualizarStatusComunicado(id, campos) {
    const sets = [], params = [];
    for (const k of ["status", "provedor_id", "evento_provedor", "erro"]) {
      if (campos[k] !== undefined) { sets.push(`${k} = ?`); params.push(campos[k]); }
    }
    if (campos.enviado) sets.push("enviado_em = CURRENT_TIMESTAMP");
    if (campos.entregue) sets.push("entregue_em = CURRENT_TIMESTAMP");
    if (!sets.length) return;
    await pool.execute(`UPDATE antt_comunicados SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  }

  /** Webhook do Resend. Entregue não sobrescreve falha confirmada (bounce). */
  async atualizarComunicadoPorProvedor(provedorId, campos) {
    const [rows] = await pool.execute("SELECT id, status FROM antt_comunicados WHERE provedor_id = ? LIMIT 1", [provedorId]);
    if (!rows[0]) return false;
    const { status, ...resto } = campos;
    const novo = status && !(rows[0].status === "FALHA" && status === "ENTREGUE") ? { status, ...resto } : resto;
    await this.atualizarStatusComunicado(rows[0].id, novo);
    return true;
  }

  /** Mesmo conteúdo para o mesmo destino há poucos minutos (outra aba, duplo envio) e que não falhou. */
  async envioRecenteIdentico(hash, minutos) {
    const [rows] = await pool.query(
      `SELECT id FROM antt_comunicados WHERE conteudo_sha256 = ? AND modo = 'REAL' AND status <> 'FALHA'
         AND criado_em > (NOW() - INTERVAL ? MINUTE) LIMIT 1`, [hash, Number(minutos)]);
    return rows[0]?.id || null;
  }

  async contarTestesRecentes(usuarioId, minutos) {
    const [[r]] = await pool.query(
      "SELECT COUNT(*) AS n FROM antt_comunicados WHERE modo = 'TESTE' AND enviado_por <=> ? AND criado_em > (NOW() - INTERVAL ? MINUTE)",
      [usuarioId ?? null, Number(minutos)]);
    return Number(r.n);
  }

  async listarComunicados({ clienteId, de, ate, modo, limite = 300 } = {}) {
    const where = [], params = [];
    if (clienteId) { where.push("cliente_id = ?"); params.push(clienteId); }
    if (de) { where.push("criado_em >= ?"); params.push(`${de} 00:00:00`); }
    if (ate) { where.push("criado_em < DATE_ADD(?, INTERVAL 1 DAY)"); params.push(ate); }
    if (modo) { where.push("modo = ?"); params.push(modo); }
    const [rows] = await pool.query(
      `SELECT id, modo, cliente_id, cliente_nome, destinatario, cc, assunto, percentual, anexos, status, provedor_id, erro,
              enviado_por_nome, ${ts("criado_em")}, ${ts("enviado_em")}, ${ts("entregue_em")}
       FROM antt_comunicados ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`, [...params, Number(limite)]);
    return rows.map(mapComunicado);
  }

  async obterComunicado(id) {
    const [rows] = await pool.execute(
      `SELECT id, chave_envio, modo, cliente_id, cliente_nome, destinatario, cc, remetente, reply_to, assunto, corpo_html, email_html,
              email_texto, percentual, DATE_FORMAT(data_vigencia, '%Y-%m-%d') AS data_vigencia, contrato_ref, anexos, status, provedor_id,
              evento_provedor, erro, enviado_por, enviado_por_nome, ${ts("criado_em")}, ${ts("enviado_em")}, ${ts("entregue_em")}
       FROM antt_comunicados WHERE id = ? LIMIT 1`, [id]);
    return mapComunicado(rows[0]) || null;
  }

  /** Clientes que aparecem no histórico (inclui excluídos), para o filtro. */
  async clientesDoHistorico() {
    const [rows] = await pool.query(
      `SELECT cliente_id AS id, MAX(cliente_nome) AS nome FROM antt_comunicados WHERE cliente_id IS NOT NULL
       GROUP BY cliente_id ORDER BY nome`);
    return rows;
  }
}

export default new AnttComunicadosRepository();
