import pool from "../config/db.js";

// Colunas DATE sempre voltam como 'YYYY-MM-DD' (evita deslocamento de fuso do driver).
const d = (col, alias = col) => `DATE_FORMAT(${col}, '%Y-%m-%d') AS ${alias}`;
const ts = (col, alias = col) => `DATE_FORMAT(${col}, '%Y-%m-%dT%H:%i:%s') AS ${alias}`;
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

async function inTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

class AnttRepository {
  // ------------------------------------------------------------ configuração / auditoria
  async getConfigRows() {
    const [rows] = await pool.query("SELECT chave, valor FROM antt_configuracoes");
    return Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
  }

  async setConfig(chave, valor, userId) {
    await pool.execute(
      `INSERT INTO antt_configuracoes (chave, valor, atualizado_por) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE valor = VALUES(valor), atualizado_por = VALUES(atualizado_por)`,
      [chave, valor, userId || null]
    );
  }

  async audit({ usuarioId, acao, entidade, entidadeId, antes, depois, ip }) {
    await pool.execute(
      `INSERT INTO antt_auditoria (usuario_id, acao, entidade, entidade_id, antes, depois, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [usuarioId || null, acao, entidade, entidadeId != null ? String(entidadeId) : null,
        antes ? JSON.stringify(antes) : null, depois ? JSON.stringify(depois) : null, ip || null]
    );
  }

  async listarAuditoria(limit = 100) {
    const [rows] = await pool.query(
      `SELECT a.id, a.usuario_id, u.nome AS usuario_nome, a.acao, a.entidade, a.entidade_id, a.antes, a.depois,
              ${ts("a.criado_em", "criado_em")}
       FROM antt_auditoria a LEFT JOIN users u ON u.id = a.usuario_id
       ORDER BY a.id DESC LIMIT ?`,
      [Number(limit)]
    );
    return rows;
  }

  async getUsuarioAcesso(userId) {
    const [rows] = await pool.execute(
      "SELECT id, nome, role, sector_id, is_active FROM users WHERE id = ? LIMIT 1", [userId]);
    return rows[0] || null;
  }

  // ------------------------------------------------------------ ANP: gravação
  async upsertDiarios(rows) {
    let total = 0;
    for (const part of chunk(rows, 500)) {
      const values = part.map((r) => [r.data_coleta, r.escopo, r.chave, "DIESEL S10", r.n_observacoes, r.soma_precos, r.preco_minimo, r.preco_maximo]);
      const [res] = await pool.query(
        `INSERT INTO antt_anp_precos_diarios
           (data_coleta, escopo, chave, produto, n_observacoes, soma_precos, preco_minimo, preco_maximo)
         VALUES ?
         ON DUPLICATE KEY UPDATE n_observacoes = VALUES(n_observacoes), soma_precos = VALUES(soma_precos),
           preco_minimo = VALUES(preco_minimo), preco_maximo = VALUES(preco_maximo)`,
        [values]
      );
      total += res.affectedRows;
    }
    return total;
  }

  async upsertSemanais(rows, fonte) {
    let total = 0;
    for (const part of chunk(rows, 500)) {
      const values = part.map((r) => [r.semana_inicio, r.semana_fim, r.escopo, r.chave, "DIESEL S10", fonte,
        r.preco_medio, r.preco_minimo ?? null, r.preco_maximo ?? null, r.n_postos ?? 0]);
      const [res] = await pool.query(
        `INSERT INTO antt_anp_precos_semanais
           (semana_inicio, semana_fim, escopo, chave, produto, fonte, preco_medio, preco_minimo, preco_maximo, n_postos)
         VALUES ?
         ON DUPLICATE KEY UPDATE semana_fim = VALUES(semana_fim), preco_medio = VALUES(preco_medio),
           preco_minimo = VALUES(preco_minimo), preco_maximo = VALUES(preco_maximo), n_postos = VALUES(n_postos)`,
        [values]
      );
      total += res.affectedRows;
    }
    return total;
  }

  /** Agrega os diários das semanas que tocam [de, ate] (inclusive semanas inteiras). */
  async agregarSemanasDeDiarios(de, ate) {
    const [rows] = await pool.execute(
      `SELECT DATE_FORMAT(DATE_SUB(data_coleta, INTERVAL (DAYOFWEEK(data_coleta) - 1) DAY), '%Y-%m-%d') AS semana_inicio,
              escopo, chave, SUM(n_observacoes) AS n, SUM(soma_precos) AS soma,
              MIN(preco_minimo) AS minimo, MAX(preco_maximo) AS maximo
       FROM antt_anp_precos_diarios
       WHERE data_coleta BETWEEN DATE_SUB(?, INTERVAL (DAYOFWEEK(?) - 1) DAY)
                             AND DATE_ADD(DATE_SUB(?, INTERVAL (DAYOFWEEK(?) - 1) DAY), INTERVAL 6 DAY)
       GROUP BY semana_inicio, escopo, chave`,
      [de, de, ate, ate]
    );
    return rows;
  }

  async listarSemanaisTodos(fonte) {
    const [rows] = await pool.execute(
      `SELECT ${d("semana_inicio")}, ${d("semana_fim")}, escopo, chave, preco_medio, n_postos
       FROM antt_anp_precos_semanais WHERE fonte = ? AND produto = 'DIESEL S10'
       ORDER BY escopo, chave, semana_inicio`,
      [fonte]
    );
    return rows;
  }

  async upsertMensais(rows) {
    let total = 0;
    for (const part of chunk(rows, 500)) {
      const values = part.map((r) => [r.ano, r.mes, r.escopo, r.chave, "DIESEL S10", r.fonte, r.metodologia,
        r.preco_medio, r.n_semanas, r.n_postos_total, r.mes_completo ? 1 : 0, r.ultima_semana_fim]);
      const [res] = await pool.query(
        `INSERT INTO antt_anp_medias_mensais
           (ano, mes, escopo, chave, produto, fonte, metodologia, preco_medio, n_semanas, n_postos_total, mes_completo, ultima_semana_fim)
         VALUES ?
         ON DUPLICATE KEY UPDATE preco_medio = VALUES(preco_medio), n_semanas = VALUES(n_semanas),
           n_postos_total = VALUES(n_postos_total), mes_completo = VALUES(mes_completo),
           ultima_semana_fim = VALUES(ultima_semana_fim)`,
        [values]
      );
      total += res.affectedRows;
    }
    return total;
  }

  // ------------------------------------------------------------ ANP: leitura
  async listarSemanais({ escopo, chave, fonte, de, ate }) {
    const [rows] = await pool.execute(
      `SELECT ${d("semana_inicio")}, ${d("semana_fim")}, escopo, chave, fonte, preco_medio, preco_minimo, preco_maximo, n_postos
       FROM antt_anp_precos_semanais
       WHERE escopo = ? AND chave = ? AND fonte = ? AND produto = 'DIESEL S10'
         AND semana_inicio >= COALESCE(?, '1900-01-01') AND semana_inicio <= COALESCE(?, '2999-12-31')
       ORDER BY semana_inicio`,
      [escopo, chave, fonte, de || null, ate || null]
    );
    return rows;
  }

  async listarMensais({ escopo, chave, fonte, metodologia }) {
    const [rows] = await pool.execute(
      `SELECT ano, mes, escopo, chave, fonte, metodologia, preco_medio, n_semanas, n_postos_total, mes_completo,
              ${d("ultima_semana_fim")}
       FROM antt_anp_medias_mensais
       WHERE escopo = ? AND chave = ? AND fonte = ? AND metodologia = ? AND produto = 'DIESEL S10'
       ORDER BY ano, mes`,
      [escopo, chave, fonte, metodologia]
    );
    return rows.map((r) => ({ ...r, mes_completo: Boolean(r.mes_completo) }));
  }

  async opcoesAnp() {
    const [fontes] = await pool.query(
      `SELECT fonte, COUNT(*) AS semanas, ${d("MIN(semana_inicio)", "primeira_semana")}, ${d("MAX(semana_fim)", "ultima_semana")},
              ${ts("MAX(atualizado_em)", "atualizado_em")}
       FROM antt_anp_precos_semanais GROUP BY fonte`);
    const [anos] = await pool.query("SELECT DISTINCT ano FROM antt_anp_medias_mensais ORDER BY ano DESC");
    return { fontes, anos: anos.map((a) => a.ano) };
  }

  async ultimaAtualizacaoAnp() {
    const [[r]] = await pool.query(
      `SELECT ${d("MAX(semana_fim)", "ultima_semana")}, ${ts("MAX(atualizado_em)", "gravado_em")} FROM antt_anp_precos_semanais`);
    return r;
  }

  // ------------------------------------------------------------ arquivos e logs de sync
  async getArquivo(url) {
    const [rows] = await pool.execute(
      `SELECT url, hash_sha256, tamanho_bytes, ${ts("processado_em")} FROM antt_anp_arquivos WHERE url = ? LIMIT 1`, [url]);
    return rows[0] || null;
  }

  async salvarArquivo({ url, fonte, hash, tamanho, linhasLidas, registros }) {
    await pool.execute(
      `INSERT INTO antt_anp_arquivos (url, fonte, hash_sha256, tamanho_bytes, linhas_lidas, registros_gravados)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE hash_sha256 = VALUES(hash_sha256), tamanho_bytes = VALUES(tamanho_bytes),
         linhas_lidas = VALUES(linhas_lidas), registros_gravados = VALUES(registros_gravados), processado_em = CURRENT_TIMESTAMP`,
      [url, fonte, hash, tamanho, linhasLidas, registros]
    );
  }

  async criarSyncLog(origem, userId) {
    const [res] = await pool.execute(
      "INSERT INTO antt_sync_logs (origem, iniciado_por) VALUES (?, ?)", [origem, userId || null]);
    return res.insertId;
  }

  async finalizarSyncLog(id, { status, arquivos, ignorados, registros, mensagem, detalhes }) {
    await pool.execute(
      `UPDATE antt_sync_logs SET status = ?, arquivos_processados = ?, arquivos_ignorados = ?, registros_gravados = ?,
         mensagem = ?, detalhes = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, arquivos, ignorados, registros, mensagem ? String(mensagem).slice(0, 1000) : null,
        detalhes ? JSON.stringify(detalhes) : null, id]
    );
  }

  async syncEmAndamentoRecente() {
    const [rows] = await pool.query(
      "SELECT id FROM antt_sync_logs WHERE status = 'EM_ANDAMENTO' AND iniciado_em > (NOW() - INTERVAL 30 MINUTE) LIMIT 1");
    return rows[0] || null;
  }

  async marcarSyncsOrfaos() {
    await pool.query(
      `UPDATE antt_sync_logs SET status = 'ERRO', mensagem = 'Interrompida (servidor reiniciado ou tempo excedido).', finalizado_em = CURRENT_TIMESTAMP
       WHERE status = 'EM_ANDAMENTO' AND iniciado_em <= (NOW() - INTERVAL 30 MINUTE)`);
  }

  /** Última sincronização concluída com dados válidos (SUCESSO ou PARCIAL). */
  async ultimoSyncOk() {
    const [rows] = await pool.query(
      `SELECT id, origem, status, ${ts("iniciado_em")}, ${ts("finalizado_em")}
       FROM antt_sync_logs WHERE status IN ('SUCESSO','PARCIAL') ORDER BY id DESC LIMIT 1`);
    return rows[0] || null;
  }

  async ultimosSyncLogs(limit = 10) {
    const [rows] = await pool.query(
      `SELECT id, origem, status, arquivos_processados, arquivos_ignorados, registros_gravados, mensagem,
              ${ts("iniciado_em")}, ${ts("finalizado_em")}
       FROM antt_sync_logs ORDER BY id DESC LIMIT ?`, [Number(limit)]);
    return rows;
  }

  // ------------------------------------------------------------ marcos
  async listarMarcos({ tipo, escopo, chave } = {}) {
    const where = [], params = [];
    if (tipo) { where.push("m.tipo = ?"); params.push(tipo); }
    if (escopo) { where.push("m.escopo = ?"); params.push(escopo); }
    if (chave) { where.push("m.chave = ?"); params.push(chave); }
    const [rows] = await pool.execute(
      `SELECT m.id, m.tipo, m.escopo, m.chave, m.fonte, m.metodologia, m.ref_ano, m.ref_mes, m.preco_referencia,
              m.origem, m.reajuste_id, m.fonte_documento, m.observacao, m.vigente, m.criado_por,
              u.nome AS criado_por_nome, ${ts("m.criado_em", "criado_em")}, ${ts("m.encerrado_em", "encerrado_em")}
       FROM antt_marcos m LEFT JOIN users u ON u.id = m.criado_por
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY m.id DESC`, params);
    return rows.map((r) => ({ ...r, vigente: Boolean(r.vigente) }));
  }

  async marcoVigente(tipo, escopo, chave) {
    const rows = await this.listarMarcos({ tipo, escopo, chave });
    return rows.find((m) => m.vigente) || null;
  }

  async criarMarco(dados, conn = null) {
    const run = async (c) => {
      await c.execute(
        `UPDATE antt_marcos SET vigente = 0, encerrado_em = CURRENT_TIMESTAMP
         WHERE tipo = ? AND escopo = ? AND chave = ? AND vigente = 1`,
        [dados.tipo, dados.escopo, dados.chave]);
      const [res] = await c.execute(
        `INSERT INTO antt_marcos (tipo, escopo, chave, fonte, metodologia, ref_ano, ref_mes, preco_referencia,
           origem, reajuste_id, fonte_documento, observacao, criado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [dados.tipo, dados.escopo, dados.chave, dados.fonte, dados.metodologia, dados.ref_ano, dados.ref_mes,
          dados.preco_referencia, dados.origem, dados.reajuste_id || null, dados.fonte_documento || null,
          dados.observacao || null, dados.criado_por || null]);
      return res.insertId;
    };
    return conn ? run(conn) : inTransaction(run);
  }

  /** Só usado para o marco INICIAL_AUTOMATICO, que acompanha a média de jan/2026 se a ANP corrigir semanas. */
  async atualizarPrecoMarco(id, preco) {
    await pool.execute("UPDATE antt_marcos SET preco_referencia = ? WHERE id = ?", [preco, id]);
  }

  /**
   * Aplica a cadeia de marcos zero automáticos (origem GATILHO_AUTOMATICO) numa transação:
   * remove os que deixaram de existir (correção da ANP), insere os novos, atualiza preço/observação
   * dos que mudaram e marca como vigente o marco de referência mais recente.
   */
  async sincronizarMarcosAutomaticos({ tipo, escopo, chave, remover = [], inserir = [], atualizar = [] }) {
    return inTransaction(async (c) => {
      for (const id of remover) {
        // marcos com decisão registrada (reajuste_id) nunca são removidos
        await c.execute("DELETE FROM antt_marcos WHERE id = ? AND origem = 'GATILHO_AUTOMATICO' AND reajuste_id IS NULL", [id]);
      }
      const criados = [];
      for (const m of inserir) {
        const [res] = await c.execute(
          `INSERT INTO antt_marcos (tipo, escopo, chave, fonte, metodologia, ref_ano, ref_mes, preco_referencia, origem, observacao, vigente)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'GATILHO_AUTOMATICO', ?, 0)`,
          [tipo, escopo, chave, m.fonte, m.metodologia, m.ref_ano, m.ref_mes, m.preco_referencia, m.observacao || null]);
        criados.push(res.insertId);
      }
      for (const m of atualizar) {
        await c.execute("UPDATE antt_marcos SET preco_referencia = ?, observacao = ? WHERE id = ? AND origem = 'GATILHO_AUTOMATICO' AND reajuste_id IS NULL",
          [m.preco_referencia, m.observacao || null, m.id]);
      }
      const [topo] = await c.execute(
        "SELECT id FROM antt_marcos WHERE tipo = ? AND escopo = ? AND chave = ? ORDER BY ref_ano DESC, ref_mes DESC, id DESC LIMIT 1",
        [tipo, escopo, chave]);
      const vigenteId = topo[0]?.id ?? null;
      if (vigenteId != null) {
        await c.execute(
          `UPDATE antt_marcos SET vigente = 0, encerrado_em = COALESCE(encerrado_em, CURRENT_TIMESTAMP)
           WHERE tipo = ? AND escopo = ? AND chave = ? AND id <> ? AND vigente = 1`, [tipo, escopo, chave, vigenteId]);
        await c.execute("UPDATE antt_marcos SET vigente = 1, encerrado_em = NULL WHERE id = ?", [vigenteId]);
      }
      return { criados, vigenteId };
    });
  }

  // ------------------------------------------------------------ escopo da planilha (BA, NE e N, 2026+)
  /** Remove dados fora do escopo (Brasil, outras regiões, estados exceto BA, microdados, antes de 2026). Idempotente. */
  async purgarForaDoEscopo(inicio) {
    const out = {};
    const [s] = await pool.execute(
      `DELETE FROM antt_anp_precos_semanais
       WHERE fonte <> 'ANP_RESUMO_SEMANAL' OR NOT ((escopo = 'REGIAO' AND chave IN ('N','NE')) OR (escopo = 'ESTADO' AND chave = 'BA')) OR produto <> 'DIESEL S10' OR semana_inicio < ?`,
      [inicio]);
    out.semanais = s.affectedRows;
    const [m] = await pool.execute(
      `DELETE FROM antt_anp_medias_mensais
       WHERE fonte <> 'ANP_RESUMO_SEMANAL' OR metodologia <> 'MEDIA_SIMPLES_SEMANAS'
          OR NOT ((escopo = 'REGIAO' AND chave IN ('N','NE')) OR (escopo = 'ESTADO' AND chave = 'BA') OR (escopo = 'COMBINADO' AND chave = 'NENO'))
          OR ano < ?`,
      [Number(inicio.slice(0, 4))]);
    out.mensais = m.affectedRows;
    const [dd] = await pool.query("DELETE FROM antt_anp_precos_diarios");
    out.diarios = dd.affectedRows;
    const [a] = await pool.query("DELETE FROM antt_anp_arquivos WHERE fonte = 'ANP_MICRODADOS'");
    out.arquivos = a.affectedRows;
    return out;
  }

  async listarSemanaisRegionais({ de, ate } = {}) {
    const [rows] = await pool.execute(
      `SELECT ${d("semana_inicio")}, ${d("semana_fim")}, escopo, chave, preco_medio, preco_minimo, preco_maximo, n_postos,
              ${ts("atualizado_em")}
       FROM antt_anp_precos_semanais
       WHERE fonte = 'ANP_RESUMO_SEMANAL' AND ((escopo = 'REGIAO' AND chave IN ('N','NE')) OR (escopo = 'ESTADO' AND chave = 'BA')) AND produto = 'DIESEL S10'
         AND semana_inicio >= COALESCE(?, '1900-01-01') AND semana_inicio <= COALESCE(?, '2999-12-31')
       ORDER BY semana_inicio, chave`,
      [de || null, ate || null]);
    return rows;
  }

  /** Recalcula integralmente as médias mensais (substitui as anteriores numa transação). */
  async substituirMensais(linhas) {
    return inTransaction(async (c) => {
      await c.query("DELETE FROM antt_anp_medias_mensais WHERE fonte = 'ANP_RESUMO_SEMANAL'");
      for (const part of chunk(linhas, 500)) {
        const values = part.map((r) => [r.ano, r.mes, r.escopo, r.chave, "DIESEL S10", "ANP_RESUMO_SEMANAL", "MEDIA_SIMPLES_SEMANAS",
          r.preco_medio, r.n_semanas, r.n_postos_total || 0, r.mes_completo ? 1 : 0, r.ultima_semana_fim]);
        await c.query(
          `INSERT INTO antt_anp_medias_mensais
             (ano, mes, escopo, chave, produto, fonte, metodologia, preco_medio, n_semanas, n_postos_total, mes_completo, ultima_semana_fim)
           VALUES ?`, [values]);
      }
      return linhas.length;
    });
  }

  // ------------------------------------------------------------ gatilhos
  async listarGatilhos({ status } = {}) {
    const [rows] = await pool.execute(
      `SELECT g.id, g.marco_id, g.direcao, g.ref_ano, g.ref_mes, g.mes_parcial, g.marco_ref_ano, g.marco_ref_mes,
              g.preco_referencia, g.preco_atual, g.variacao_pct, g.diferenca_rs, g.status,
              ${ts("g.detectado_em", "detectado_em")}, ${ts("g.atualizado_em", "atualizado_em")}, ${ts("g.tratado_em", "tratado_em")},
              g.tratado_por, u.nome AS tratado_por_nome, g.reajuste_id, g.observacao
       FROM antt_gatilhos g LEFT JOIN users u ON u.id = g.tratado_por
       WHERE (? IS NULL OR g.status = ?) ORDER BY g.id DESC`,
      [status || null, status || null]);
    return rows.map((r) => ({ ...r, mes_parcial: Boolean(r.mes_parcial) }));
  }

  /** Gatilhos que ficaram ABERTOS na regra antiga (confirmação manual): o mês virou marco zero automático. */
  async encerrarGatilhosAbertos() {
    const [abertos] = await pool.query("SELECT id FROM antt_gatilhos WHERE status = 'ABERTO'");
    if (!abertos.length) return [];
    await pool.query(
      `UPDATE antt_gatilhos SET status = 'MARCO_AUTOMATICO', tratado_em = CURRENT_TIMESTAMP,
         observacao = 'Regra automática: o mês que atingiu o gatilho passou a ser o novo marco zero.' WHERE status = 'ABERTO'`);
    return abertos.map((g) => g.id);
  }

  // ------------------------------------------------------------ reajustes (eventos)
  async listarReajustes() {
    const [rows] = await pool.query(
      `SELECT r.id, r.marco_id, r.direcao, r.ref_ano, r.ref_mes, r.preco_apurado, r.preco_referencia, r.variacao_pct,
              r.percentual_aplicado, ${d("r.data_vigencia", "data_vigencia")}, r.status, r.justificativa,
              r.aprovado_por, u.nome AS aprovado_por_nome, ${ts("r.aprovado_em", "aprovado_em")}, r.novo_marco_id
       FROM antt_reajustes r LEFT JOIN users u ON u.id = r.aprovado_por ORDER BY r.id DESC`);
    return rows;
  }

  /** Grava a decisão humana sobre o reajuste de um marco automático e fixa esse marco (reajuste_id). */
  async registrarDecisaoReajuste(e, usuarioId) {
    return inTransaction(async (c) => {
      const [res] = await c.execute(
        `INSERT INTO antt_reajustes (marco_id, direcao, ref_ano, ref_mes, preco_apurado, preco_referencia, variacao_pct,
           percentual_aplicado, data_vigencia, status, justificativa, aprovado_por, novo_marco_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.marco_id, e.direcao, e.ref_ano, e.ref_mes, e.preco_apurado, e.preco_referencia, e.variacao_pct,
          e.percentual_aplicado, e.data_vigencia, e.status, e.justificativa, usuarioId, e.novo_marco_id]);
      const [upd] = await c.execute("UPDATE antt_marcos SET reajuste_id = ? WHERE id = ? AND reajuste_id IS NULL", [res.insertId, e.novo_marco_id]);
      if (!upd.affectedRows) { const err = new Error("A decisão sobre este gatilho já foi registrada."); err.status = 409; throw err; }
      return res.insertId;
    });
  }

  // ------------------------------------------------------------ notificações por e-mail
  /** Insere eventos ainda não registrados (chave única). Devolve só os NOVOS, com id. */
  async registrarEventosGatilho(eventos) {
    const novos = [];
    for (const e of eventos) {
      const [res] = await pool.execute(
        `INSERT IGNORE INTO antt_eventos_gatilho (chave_evento, indicador, direcao, ref_ano, ref_mes, marco_ref_ano, marco_ref_mes,
           preco_referencia, preco_apurado, variacao_pct, mes_parcial, historico)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [e.chave_evento, e.indicador, e.direcao, e.ref_ano, e.ref_mes, e.marco_ref_ano, e.marco_ref_mes,
          e.preco_referencia, e.preco_apurado, e.variacao_pct, e.mes_parcial ? 1 : 0, e.historico ? 1 : 0]);
      if (res.affectedRows === 1) novos.push({ ...e, id: res.insertId });
    }
    return novos;
  }

  async listarEventosGatilho(limit = 60) {
    const [rows] = await pool.query(
      `SELECT id, chave_evento, indicador, direcao, ref_ano, ref_mes, marco_ref_ano, marco_ref_mes, preco_referencia, preco_apurado,
              variacao_pct, mes_parcial, historico, notificacao_id, ${ts("detectado_em")}
       FROM antt_eventos_gatilho ORDER BY ref_ano DESC, ref_mes DESC, id DESC LIMIT ?`, [Number(limit)]);
    return rows.map((r) => ({ ...r, mes_parcial: Boolean(r.mes_parcial), historico: Boolean(r.historico) }));
  }

  async eventosDaNotificacao(notificacaoId) {
    const [rows] = await pool.execute(
      "SELECT indicador, direcao, ref_ano, ref_mes, variacao_pct, mes_parcial FROM antt_eventos_gatilho WHERE notificacao_id = ? ORDER BY id", [notificacaoId]);
    return rows.map((r) => ({ ...r, mes_parcial: Boolean(r.mes_parcial) }));
  }

  /** Cria a notificação (PENDENTE) e vincula os eventos na mesma transação. */
  async criarNotificacao({ tipo, modo, destinatario, assunto = null, tipo_alerta = null, indicadores = null, eventoIds = [], criado_por = null }) {
    return inTransaction(async (c) => {
      const [res] = await c.execute(
        `INSERT INTO antt_notificacoes (tipo, modo, destinatario, assunto, tipo_alerta, indicadores, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tipo, modo, destinatario || "", assunto, tipo_alerta, indicadores, criado_por]);
      if (eventoIds.length) await c.query("UPDATE antt_eventos_gatilho SET notificacao_id = ? WHERE id IN (?)", [res.insertId, eventoIds]);
      return res.insertId;
    });
  }

  /** Atualiza campos da notificação. espera_min agenda a próxima tentativa (null = sem nova tentativa). */
  async atualizarNotificacao(id, campos) {
    const sets = [], params = [];
    for (const k of ["status", "tentativas", "destinatario", "modo", "assunto", "tipo_alerta", "provedor_id", "erro", "evento_provedor"]) {
      if (campos[k] !== undefined) { sets.push(`${k} = ?`); params.push(campos[k]); }
    }
    if (campos.espera_min !== undefined) {
      if (campos.espera_min === null) sets.push("proxima_tentativa_em = NULL");
      else { sets.push("proxima_tentativa_em = DATE_ADD(NOW(), INTERVAL ? MINUTE)"); params.push(Number(campos.espera_min)); }
    }
    if (campos.enviado) sets.push("enviado_em = CURRENT_TIMESTAMP");
    if (campos.entregue) sets.push("entregue_em = CURRENT_TIMESTAMP");
    if (!sets.length) return;
    await pool.execute(`UPDATE antt_notificacoes SET ${sets.join(", ")} WHERE id = ?`, [...params, id]);
  }

  async atualizarNotificacaoPorProvedor(provedorId, campos) {
    const [rows] = await pool.execute("SELECT id, status FROM antt_notificacoes WHERE provedor_id = ? LIMIT 1", [provedorId]);
    if (!rows[0]) return false;
    // entregue não volta para enviado; falha confirmada (bounce) não é sobrescrita por eventos posteriores
    const { status, ...resto } = campos;
    const novo = status && !(rows[0].status === "FALHA" && status === "ENTREGUE") ? { status, ...resto } : resto;
    await this.atualizarNotificacao(rows[0].id, novo);
    return true;
  }

  /** Gatilhos a enviar: pendentes e falhas temporárias com nova tentativa vencida. */
  async notificacoesParaEnviar(maxTentativas) {
    const [rows] = await pool.query(
      `SELECT id, tipo, modo, destinatario, tentativas, status FROM antt_notificacoes
       WHERE tipo = 'GATILHO' AND (status = 'PENDENTE'
          OR (status = 'FALHA' AND proxima_tentativa_em IS NOT NULL AND proxima_tentativa_em <= NOW() AND tentativas < ?))
       ORDER BY id`, [Number(maxTentativas)]);
    return rows;
  }

  /** Envio interrompido no meio (servidor caiu): não reenvia sozinho para não duplicar — fica para conferência. */
  async marcarEnviosInterrompidos(minutos) {
    await pool.query(
      `UPDATE antt_notificacoes SET status = 'FALHA', proxima_tentativa_em = NULL,
         erro = 'Envio interrompido (servidor reiniciado durante o envio). Confira no painel do Resend antes de reenviar.'
       WHERE status = 'ENVIANDO' AND atualizado_em < (NOW() - INTERVAL ? MINUTE)`, [Number(minutos)]);
  }

  async contarTestesRecentes(userId, minutos) {
    const [[r]] = await pool.query(
      "SELECT COUNT(*) AS n FROM antt_notificacoes WHERE tipo = 'TESTE' AND criado_por <=> ? AND criado_em > (NOW() - INTERVAL ? MINUTE)", [userId ?? null, Number(minutos)]);
    return Number(r.n);
  }

  async listarNotificacoes(limit = 40) {
    const [rows] = await pool.query(
      `SELECT id, tipo, modo, destinatario, assunto, tipo_alerta, indicadores, status, tentativas, provedor_id, evento_provedor, erro,
              ${ts("criado_em")}, ${ts("atualizado_em")}, ${ts("enviado_em")}, ${ts("entregue_em")}, ${ts("proxima_tentativa_em")}
       FROM antt_notificacoes ORDER BY id DESC LIMIT ?`, [Number(limit)]);
    return rows;
  }

  // ------------------------------------------------------------ alertas
  /**
   * Cria o alerta uma única vez por alert_key (sem duplicar). Enquanto aberto só atualiza texto/variação.
   * Alertas resolvidos AUTOMATICAMENTE (resolvido_por NULL) reabrem se a condição voltar; os dispensados
   * manualmente por um usuário permanecem resolvidos.
   */
  async registrarAlerta(a) {
    const [res] = await pool.execute(
      `INSERT INTO antt_alertas (alert_key, tipo, severidade, titulo, mensagem, marco_id, ref_ano, ref_mes, variacao_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         mensagem = IF(resolvido = 0 OR resolvido_por IS NULL, VALUES(mensagem), mensagem),
         variacao_pct = IF(resolvido = 0 OR resolvido_por IS NULL, VALUES(variacao_pct), variacao_pct),
         ref_ano = IF(resolvido = 0 OR resolvido_por IS NULL, VALUES(ref_ano), ref_ano),
         ref_mes = IF(resolvido = 0 OR resolvido_por IS NULL, VALUES(ref_mes), ref_mes),
         resolvido_em = IF(resolvido_por IS NULL, NULL, resolvido_em),
         resolvido = IF(resolvido_por IS NULL, 0, resolvido)`,
      [a.alert_key, a.tipo, a.severidade || "INFO", a.titulo, String(a.mensagem).slice(0, 600),
        a.marco_id || null, a.ref_ano || null, a.ref_mes || null, a.variacao_pct ?? null]);
    return res.affectedRows === 1; // 1 = criado; 2 = atualizado; 0 = sem mudança
  }

  async resolverAlertaPorChave(alertKey, usuarioId = null) {
    await pool.execute(
      `UPDATE antt_alertas SET resolvido = 1, resolvido_por = ?, resolvido_em = CURRENT_TIMESTAMP
       WHERE alert_key = ? AND resolvido = 0`, [usuarioId, alertKey]);
  }

  async resolverAlerta(id, usuarioId) {
    const [res] = await pool.execute(
      `UPDATE antt_alertas SET resolvido = 1, resolvido_por = ?, resolvido_em = CURRENT_TIMESTAMP
       WHERE id = ? AND resolvido = 0`, [usuarioId, id]);
    return res.affectedRows > 0;
  }

  async listarAlertas({ abertos = true, limit = 50 } = {}) {
    const [rows] = await pool.query(
      `SELECT id, alert_key, tipo, severidade, titulo, mensagem, marco_id, ref_ano, ref_mes, variacao_pct, resolvido,
              ${ts("criado_em")}, ${ts("atualizado_em")}
       FROM antt_alertas ${abertos ? "WHERE resolvido = 0" : ""} ORDER BY id DESC LIMIT ?`, [Number(limit)]);
    return rows.map((r) => ({ ...r, resolvido: Boolean(r.resolvido) }));
  }

  // ------------------------------------------------------------ tabelas ANTT
  async listarTabelasFrete() {
    const [tabs] = await pool.query(
      `SELECT t.id, t.tabela, t.tipo_carga, ${d("t.vigencia_inicio", "vigencia_inicio")}, t.norma, t.fonte_url, t.observacao,
              u.nome AS criado_por_nome, ${ts("t.criado_em", "criado_em")}
       FROM antt_tabelas_frete t LEFT JOIN users u ON u.id = t.criado_por
       ORDER BY t.tabela, t.tipo_carga, t.vigencia_inicio DESC`);
    if (!tabs.length) return [];
    const [itens] = await pool.query(
      "SELECT tabela_id, eixos, ccd, cc FROM antt_tabelas_frete_itens ORDER BY tabela_id, eixos");
    const porTabela = new Map();
    for (const i of itens) {
      if (!porTabela.has(i.tabela_id)) porTabela.set(i.tabela_id, []);
      porTabela.get(i.tabela_id).push({ eixos: i.eixos, ccd: i.ccd, cc: i.cc });
    }
    // vigência_fim derivada: dia anterior ao início da versão seguinte (mesma tabela/carga)
    const grupos = new Map();
    for (const t of tabs) {
      const k = `${t.tabela}|${t.tipo_carga}`;
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(t);
    }
    for (const lista of grupos.values()) {
      lista.sort((a, b) => a.vigencia_inicio.localeCompare(b.vigencia_inicio));
      lista.forEach((t, i) => {
        const prox = lista[i + 1];
        if (prox) {
          const dt = new Date(`${prox.vigencia_inicio}T00:00:00Z`); dt.setUTCDate(dt.getUTCDate() - 1);
          t.vigencia_fim = dt.toISOString().slice(0, 10);
        } else t.vigencia_fim = null;
      });
    }
    return tabs.map((t) => ({ ...t, itens: porTabela.get(t.id) || [] }));
  }

  async criarTabelaFrete({ tabela, tipo_carga, vigencia_inicio, norma, fonte_url, observacao, itens, usuarioId }) {
    return inTransaction(async (c) => {
      const [res] = await c.execute(
        `INSERT INTO antt_tabelas_frete (tabela, tipo_carga, vigencia_inicio, norma, fonte_url, observacao, criado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tabela, tipo_carga, vigencia_inicio, norma, fonte_url, observacao || null, usuarioId || null]);
      for (const i of itens) {
        await c.execute(
          "INSERT INTO antt_tabelas_frete_itens (tabela_id, eixos, ccd, cc) VALUES (?, ?, ?, ?)",
          [res.insertId, i.eixos, i.ccd, i.cc]);
      }
      return res.insertId;
    });
  }

  /** Versão vigente em `data` para a tabela/carga (a mais recente com início <= data). */
  async tabelaVigente(tabela, tipoCarga, data) {
    const [rows] = await pool.execute(
      `SELECT id, tabela, tipo_carga, ${d("vigencia_inicio")}, norma, fonte_url
       FROM antt_tabelas_frete WHERE tabela = ? AND tipo_carga = ? AND vigencia_inicio <= ?
       ORDER BY vigencia_inicio DESC LIMIT 1`, [tabela, tipoCarga, data]);
    return rows[0] || null;
  }

  async tabelaPorId(id) {
    const [rows] = await pool.execute(
      `SELECT id, tabela, tipo_carga, ${d("vigencia_inicio")}, norma, fonte_url FROM antt_tabelas_frete WHERE id = ? LIMIT 1`, [id]);
    return rows[0] || null;
  }

  async itemTabela(tabelaId, eixos) {
    const [rows] = await pool.execute(
      "SELECT eixos, ccd, cc FROM antt_tabelas_frete_itens WHERE tabela_id = ? AND eixos = ? LIMIT 1", [tabelaId, eixos]);
    return rows[0] || null;
  }

  // ------------------------------------------------------------ clientes / contratos / fretes
  async listarClientes() {
    const [rows] = await pool.query(
      `SELECT c.id, c.nome, c.documento, c.ativo, COUNT(f.id) AS qtd_fretes
       FROM antt_clientes c LEFT JOIN antt_fretes f ON f.cliente_id = c.id
       GROUP BY c.id ORDER BY c.nome`);
    return rows.map((r) => ({ ...r, ativo: Boolean(r.ativo) }));
  }

  async clientePorId(id) {
    const [rows] = await pool.execute("SELECT id, nome, documento FROM antt_clientes WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  async criarCliente({ nome, documento, usuarioId }) {
    const [res] = await pool.execute(
      "INSERT INTO antt_clientes (nome, documento, criado_por) VALUES (?, ?, ?)", [nome, documento || null, usuarioId || null]);
    return res.insertId;
  }

  async listarContratos(clienteId = null) {
    const [rows] = await pool.execute(
      `SELECT c.id, c.cliente_id, cl.nome AS cliente_nome, c.descricao, c.elegibilidade,
              ${d("c.data_aplicacao_reajuste", "data_aplicacao_reajuste")}, c.aplicacao_confirmada, c.observacao
       FROM antt_contratos c INNER JOIN antt_clientes cl ON cl.id = c.cliente_id
       WHERE (? IS NULL OR c.cliente_id = ?) ORDER BY cl.nome, c.id DESC`, [clienteId, clienteId]);
    return rows.map((r) => ({ ...r, aplicacao_confirmada: Boolean(r.aplicacao_confirmada) }));
  }

  async contratoPorId(id) {
    const [rows] = await pool.execute(
      `SELECT id, cliente_id, descricao, elegibilidade, ${d("data_aplicacao_reajuste")}, aplicacao_confirmada
       FROM antt_contratos WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? { ...rows[0], aplicacao_confirmada: Boolean(rows[0].aplicacao_confirmada) } : null;
  }

  async criarContrato(c) {
    const [res] = await pool.execute(
      `INSERT INTO antt_contratos (cliente_id, descricao, elegibilidade, data_aplicacao_reajuste, aplicacao_confirmada, observacao, criado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [c.cliente_id, c.descricao, c.elegibilidade, c.data_aplicacao_reajuste || null, c.aplicacao_confirmada ? 1 : 0,
        c.observacao || null, c.usuarioId || null]);
    return res.insertId;
  }

  async atualizarContrato(id, c) {
    await pool.execute(
      `UPDATE antt_contratos SET descricao = ?, elegibilidade = ?, data_aplicacao_reajuste = ?, aplicacao_confirmada = ?, observacao = ?
       WHERE id = ?`,
      [c.descricao, c.elegibilidade, c.data_aplicacao_reajuste || null, c.aplicacao_confirmada ? 1 : 0, c.observacao || null, id]);
  }

  /** Duplicidade (cliente + identificação) é contada e ignorada; qualquer outro erro interrompe (sem INSERT IGNORE). */
  async inserirFretes(fretes, usuarioId) {
    let inseridos = 0;
    for (const f of fretes) {
      try {
        await pool.execute(
          `INSERT INTO antt_fretes (cliente_id, contrato_id, identificacao, data_frete, km, valor_cobrado, tabela,
             tipo_carga, eixos, ccd_aplicado, cc_aplicado, criado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [f.cliente_id, f.contrato_id || null, f.identificacao, f.data_frete, f.km, f.valor_cobrado, f.tabela || null,
            f.tipo_carga || "CARGA_GERAL", f.eixos || null, f.ccd_aplicado ?? null, f.cc_aplicado ?? null, usuarioId || null]);
        inseridos++;
      } catch (e) {
        if (e.code !== "ER_DUP_ENTRY") throw e;
      }
    }
    return { inseridos, duplicados: fretes.length - inseridos };
  }

  async listarFretes({ clienteId, de, ate, limit = 500 }) {
    const [rows] = await pool.execute(
      `SELECT f.id, f.cliente_id, cl.nome AS cliente_nome, f.contrato_id, f.identificacao, ${d("f.data_frete", "data_frete")},
              f.km, f.valor_cobrado, f.tabela, f.tipo_carga, f.eixos, f.ccd_aplicado, f.cc_aplicado
       FROM antt_fretes f INNER JOIN antt_clientes cl ON cl.id = f.cliente_id
       WHERE (? IS NULL OR f.cliente_id = ?) AND f.data_frete >= COALESCE(?, '1900-01-01') AND f.data_frete <= COALESCE(?, '2999-12-31')
       ORDER BY f.data_frete DESC, f.id DESC LIMIT ${Number(limit) | 0}`,
      [clienteId ?? null, clienteId ?? null, de || null, ate || null]);
    return rows;
  }

  // ------------------------------------------------------------ retroativos
  async salvarRetroativo({ cabecalho, itens, resumo }) {
    return inTransaction(async (c) => {
      const [res] = await c.execute(
        `INSERT INTO antt_retroativos (cliente_id, contrato_id, periodo_inicio, periodo_fim, data_vigencia_reajuste, tabela_nova_id,
           apenas_positivas, status, qtd_fretes, km_total, km_medio, total_cobrado, total_recalculado, total_retroativo, observacao, criado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cabecalho.cliente_id, cabecalho.contrato_id || null, cabecalho.periodo_inicio, cabecalho.periodo_fim,
          cabecalho.data_vigencia_reajuste, cabecalho.tabela_nova_id, cabecalho.apenas_positivas ? 1 : 0, cabecalho.status,
          resumo.qtd_fretes, resumo.km_total, resumo.km_medio, resumo.total_cobrado, resumo.total_recalculado,
          resumo.total_retroativo, cabecalho.observacao || null, cabecalho.usuarioId || null]);
      for (const i of itens) {
        await c.execute(
          `INSERT INTO antt_retroativo_itens (retroativo_id, frete_id, identificacao, data_frete, km, valor_cobrado, ccd_original,
             cc_original, ccd_novo, cc_novo, valor_recalculado, diferenca, efeito_ccd, efeito_cc)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [res.insertId, i.frete_id, i.identificacao, i.data_frete, i.km, i.valor_cobrado, i.ccd_original, i.cc_original,
            i.ccd_novo, i.cc_novo, i.valor_recalculado, i.diferenca, i.efeito_ccd, i.efeito_cc]);
      }
      return res.insertId;
    });
  }

  async listarRetroativos() {
    const [rows] = await pool.query(
      `SELECT r.id, r.cliente_id, cl.nome AS cliente_nome, ${d("r.periodo_inicio", "periodo_inicio")}, ${d("r.periodo_fim", "periodo_fim")},
              ${d("r.data_vigencia_reajuste", "data_vigencia_reajuste")}, r.status, r.qtd_fretes, r.total_cobrado,
              r.total_recalculado, r.total_retroativo, ${ts("r.criado_em", "criado_em")}
       FROM antt_retroativos r INNER JOIN antt_clientes cl ON cl.id = r.cliente_id ORDER BY r.id DESC LIMIT 200`);
    return rows;
  }

  async obterRetroativo(id) {
    const [[cab]] = await pool.execute(
      `SELECT r.id, r.cliente_id, cl.nome AS cliente_nome, ${d("r.periodo_inicio", "periodo_inicio")}, ${d("r.periodo_fim", "periodo_fim")},
              ${d("r.data_vigencia_reajuste", "data_vigencia_reajuste")}, r.tabela_nova_id, r.apenas_positivas, r.status, r.qtd_fretes,
              r.km_total, r.km_medio, r.total_cobrado, r.total_recalculado, r.total_retroativo, r.observacao,
              ${ts("r.criado_em", "criado_em")}, t.tabela, t.tipo_carga, t.norma, t.fonte_url, ${d("t.vigencia_inicio", "tabela_vigencia")}
       FROM antt_retroativos r INNER JOIN antt_clientes cl ON cl.id = r.cliente_id
       INNER JOIN antt_tabelas_frete t ON t.id = r.tabela_nova_id WHERE r.id = ?`, [id]);
    if (!cab) return null;
    const [itens] = await pool.execute(
      `SELECT identificacao, ${d("data_frete", "data_frete")}, km, valor_cobrado, ccd_original, cc_original, ccd_novo, cc_novo,
              valor_recalculado, diferenca, efeito_ccd, efeito_cc
       FROM antt_retroativo_itens WHERE retroativo_id = ? ORDER BY data_frete, id`, [id]);
    return { ...cab, apenas_positivas: Boolean(cab.apenas_positivas), itens };
  }
}

export default new AnttRepository();
