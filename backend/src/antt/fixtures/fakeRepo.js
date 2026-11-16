// Repositório em memória para testes de fluxo (substitui os métodos do repositório real via t.mock).
import repo from "../../repositories/antt.repository.js";

export function instalarRepoEmMemoria(t, { semanas = [], config = {} } = {}) {
  const db = { semanas: [...semanas], medias: [], marcos: [], gatilhos: [], alertas: new Map(), auditoria: [], reajustes: [], seq: { marco: 0, gatilho: 0 } };
  const m = (nome, fn) => t.mock.method(repo, nome, fn);

  m("getConfigRows", async () => ({ ...config }));
  m("audit", async (a) => { db.auditoria.push(a); });
  m("listarSemanaisRegionais", async () => [...db.semanas].sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio)));
  m("substituirMensais", async (linhas) => { db.medias = linhas.map((l) => ({ ...l, exato: undefined })); return linhas.length; });
  m("listarMensais", async ({ escopo, chave }) => db.medias.filter((x) => x.escopo === escopo && x.chave === chave)
    .map((x) => ({ ano: x.ano, mes: x.mes, preco_medio: x.preco_medio, n_semanas: x.n_semanas, mes_completo: x.mes_completo, ultima_semana_fim: x.ultima_semana_fim })));
  m("listarMarcos", async ({ tipo, escopo, chave } = {}) => db.marcos
    .filter((x) => (!tipo || x.tipo === tipo) && (!escopo || x.escopo === escopo) && (!chave || x.chave === chave))
    .sort((a, b) => b.id - a.id).map((x) => ({ ...x })));
  m("criarMarco", async (dados) => {
    db.marcos.filter((x) => x.tipo === dados.tipo && x.escopo === dados.escopo && x.chave === dados.chave && x.vigente).forEach((x) => { x.vigente = false; x.encerrado_em = "agora"; });
    const id = ++db.seq.marco;
    db.marcos.push({ ...dados, id, vigente: true, encerrado_em: null });
    return id;
  });
  m("atualizarPrecoMarco", async (id, preco) => { db.marcos.find((x) => x.id === id).preco_referencia = preco; });
  m("encerrarGatilhosAbertos", async () => {
    const abertos = db.gatilhos.filter((g) => g.status === "ABERTO");
    abertos.forEach((g) => { g.status = "MARCO_AUTOMATICO"; });
    return abertos.map((g) => g.id);
  });
  m("sincronizarMarcosAutomaticos", async ({ tipo, escopo, chave, remover = [], inserir = [], atualizar = [] }) => {
    db.marcos = db.marcos.filter((x) => !(remover.includes(x.id) && x.origem === "GATILHO_AUTOMATICO" && x.reajuste_id == null));
    const criados = inserir.map((dados) => {
      const id = ++db.seq.marco;
      db.marcos.push({ ...dados, tipo, escopo, chave, origem: "GATILHO_AUTOMATICO", id, vigente: false, encerrado_em: null });
      return id;
    });
    for (const u of atualizar) Object.assign(db.marcos.find((x) => x.id === u.id), { preco_referencia: u.preco_referencia, observacao: u.observacao });
    const grupo = db.marcos.filter((x) => x.tipo === tipo && x.escopo === escopo && x.chave === chave);
    const topo = [...grupo].sort((x, y) => (y.ref_ano * 12 + y.ref_mes) - (x.ref_ano * 12 + x.ref_mes) || y.id - x.id)[0];
    for (const x of grupo) {
      if (x === topo) Object.assign(x, { vigente: true, encerrado_em: null });
      else if (x.vigente) Object.assign(x, { vigente: false, encerrado_em: "agora" });
    }
    return { criados, vigenteId: topo?.id ?? null };
  });
  m("registrarDecisaoReajuste", async (e, usuarioId) => {
    const marco = db.marcos.find((x) => x.id === e.novo_marco_id);
    if (marco.reajuste_id) { const err = new Error("A decisão sobre este gatilho já foi registrada."); err.status = 409; throw err; }
    const id = (db.reajustes.length ? Math.max(...db.reajustes.map((r) => r.id)) : 0) + 1;
    db.reajustes.push({ ...e, id, aprovado_por: usuarioId });
    marco.reajuste_id = id;
    return id;
  });
  // ---- configurações e notificações por e-mail (relógio controlável: db.agora, em ms)
  db.agora = Date.now(); db.eventos = []; db.notificacoes = [];
  m("setConfig", async (k, v) => { config[k] = v; });
  m("registrarEventosGatilho", async (eventos) => {
    const novos = [];
    for (const e of eventos) {
      if (db.eventos.some((x) => x.chave_evento === e.chave_evento)) continue;
      const ev = { ...e, id: db.eventos.length + 1, historico: Boolean(e.historico), notificacao_id: null };
      db.eventos.push(ev); novos.push({ ...ev });
    }
    return novos;
  });
  m("listarEventosGatilho", async () => [...db.eventos].reverse());
  m("eventosDaNotificacao", async (id) => db.eventos.filter((e) => e.notificacao_id === id));
  m("criarNotificacao", async ({ eventoIds = [], ...n }) => {
    const id = db.notificacoes.length + 1;
    db.notificacoes.push({ assunto: null, ...n, id, status: "PENDENTE", tentativas: 0, proxima_tentativa_em: null, provedor_id: null, erro: null, criado_em: db.agora, atualizado_em: db.agora });
    for (const e of db.eventos) if (eventoIds.includes(e.id)) e.notificacao_id = id;
    return id;
  });
  m("atualizarNotificacao", async (id, c) => {
    const n = db.notificacoes.find((x) => x.id === id);
    for (const k of ["status", "tentativas", "destinatario", "modo", "assunto", "tipo_alerta", "provedor_id", "erro", "evento_provedor"]) if (c[k] !== undefined) n[k] = c[k];
    if (c.espera_min !== undefined) n.proxima_tentativa_em = c.espera_min === null ? null : db.agora + c.espera_min * 60000;
    if (c.enviado) n.enviado_em = db.agora;
    if (c.entregue) n.entregue_em = db.agora;
    n.atualizado_em = db.agora;
  });
  m("atualizarNotificacaoPorProvedor", async (pid, c) => {
    const n = db.notificacoes.find((x) => x.provedor_id === pid);
    if (!n) return false;
    const { status, ...resto } = c;
    Object.assign(n, resto, status && !(n.status === "FALHA" && status === "ENTREGUE") ? { status } : {});
    if (c.entregue) n.entregue_em = db.agora;
    return true;
  });
  m("notificacoesParaEnviar", async (max) => db.notificacoes.filter((n) => n.tipo === "GATILHO" &&
    (n.status === "PENDENTE" || (n.status === "FALHA" && n.proxima_tentativa_em != null && n.proxima_tentativa_em <= db.agora && n.tentativas < max))).map((n) => ({ ...n })));
  m("marcarEnviosInterrompidos", async (min) => {
    for (const n of db.notificacoes) if (n.status === "ENVIANDO" && n.atualizado_em < db.agora - min * 60000) Object.assign(n, { status: "FALHA", proxima_tentativa_em: null, erro: "Envio interrompido" });
  });
  m("contarTestesRecentes", async (uid, min) => db.notificacoes.filter((n) => n.tipo === "TESTE" && n.criado_por === uid && n.criado_em > db.agora - min * 60000).length);
  m("listarNotificacoes", async () => [...db.notificacoes].reverse());
  m("registrarAlerta", async (a) => {
    const existente = db.alertas.get(a.alert_key);
    if (!existente) { db.alertas.set(a.alert_key, { ...a, resolvido: false, resolvido_por: null }); return true; }
    if (!existente.resolvido || existente.resolvido_por == null) Object.assign(existente, a, { resolvido: existente.resolvido_por == null ? false : existente.resolvido });
    return false;
  });
  m("resolverAlertaPorChave", async (key, usuarioId = null) => { const a = db.alertas.get(key); if (a && !a.resolvido) Object.assign(a, { resolvido: true, resolvido_por: usuarioId }); });
  return db;
}

/** Semana oficial (domingo→sábado) de uma localidade com preço médio informado (BA = estado; NE/N = região). */
export function semana(inicio, chave, preco, escopo = chave === "BA" ? "ESTADO" : "REGIAO") {
  const fim = new Date(`${inicio}T00:00:00Z`); fim.setUTCDate(fim.getUTCDate() + 6);
  return { semana_inicio: inicio, semana_fim: fim.toISOString().slice(0, 10), escopo, chave, preco_medio: preco, n_postos: 100 };
}

/** Gera as semanas de um mês (todos os domingos do mês) com o mesmo preço para NE e N (e BA, se informado). */
export function mesInteiro(ano, mes, precoNE, precoN, precoBA = null) {
  const out = [];
  const d = new Date(Date.UTC(ano, mes - 1, 1));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  for (; d.getUTCMonth() === mes - 1; d.setUTCDate(d.getUTCDate() + 7)) {
    const ini = d.toISOString().slice(0, 10);
    out.push(semana(ini, "NE", precoNE), semana(ini, "N", precoN));
    if (precoBA != null) out.push(semana(ini, "BA", precoBA));
  }
  return out;
}
