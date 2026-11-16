import { z } from "zod";
import ExcelJS from "exceljs";
import repo from "../repositories/antt.repository.js";
import * as D from "../antt/decimal.js";
import { getConfig } from "../antt/config.js";
import { COMBINADO, INICIO_SERIE, METODOLOGIAS, tabelaPlanilha, distanciaGatilhos } from "../antt/anpCalc.js";
import { carregarIndicadores, recalcularIndicadores, situacaoAtual } from "../antt/triggers.js";
import { calcularFrete, calcularRetroativo, MODOS_AJUSTE_CC } from "../antt/freight.js";
import { parseCsv, decodificarTexto, norm } from "../antt/anpParser.js";

export class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; Object.assign(this, extra); }
}
const bad = (msg, extra) => new HttpError(400, msg, extra);
const hoje = () => new Date().toISOString().slice(0, 10);

function validar(schema, dados) {
  const r = schema.safeParse(dados);
  if (!r.success) {
    const i = r.error.issues[0];
    throw bad(`Dados inválidos${i?.path?.length ? ` (${i.path.join(".")})` : ""}: ${i?.message || "verifique os campos"}`);
  }
  return r.data;
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD").refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // rejeita 31/02 etc.
}, "data inexistente no calendário");
const decimal = (nome) => z.union([z.string(), z.number()]).transform((v, ctx) => {
  try { return D.round(v, 6); } catch { ctx.addIssue({ code: "custom", message: `${nome} inválido` }); return z.NEVER; }
});
const filtroAno = z.object({
  ano: z.coerce.number().int().min(2026).max(2100).optional(),
  base: z.enum(["NENO", "BA", "NE", "N"]).optional(),
});

// ============================================================ acesso
export async function verificarAcesso(userId) {
  const u = await repo.getUsuarioAcesso(userId);
  if (!u || !u.is_active) return { acesso: false, pode_editar: false, pode_comunicar: false, motivo: "Usuário inativo ou inexistente." };
  if (u.role === "admin") return { acesso: true, pode_editar: true, pode_comunicar: true, role: u.role };
  const cfg = await getConfig();
  const ok = u.sector_id != null && cfg.setores_autorizados.includes(Number(u.sector_id));
  // "Comunicar reajuste" (e-mails a clientes): só setores com acesso ao módulo E marcados para comunicados.
  const comunica = ok && (cfg.setores_comunicados || []).includes(Number(u.sector_id));
  return ok
    ? { acesso: true, pode_editar: false, pode_comunicar: comunica, role: u.role }
    : { acesso: false, pode_editar: false, pode_comunicar: false, role: u.role, motivo: "Seu setor não está autorizado a acessar o módulo ANTT." };
}

// ============================================================ configuração (leitura segura)
export async function configuracaoPublica() {
  const cfg = await getConfig();
  return { ...cfg, inicio_serie: INICIO_SERIE, modos_ajuste: MODOS_AJUSTE_CC, metodologias: METODOLOGIAS, regras: REGRAS };
}

export const REGRAS = [
  "Fonte: preço médio de revenda oficial da ANP (levantamento semanal), Diesel S10 — estado da Bahia e regiões Norte e Nordeste —, a partir de 01/01/2026.",
  "Cada semana pertence ao mês da sua data inicial (início da pesquisa).",
  "Média mensal de cada região = média aritmética simples dos preços médios semanais do mês.",
  "Média NE/NO = (média NE + média NO) / 2 — indicador gerencial da empresa (reproduz a planilha), não é média oficial ponderada da ANP.",
  "Bahia (BA) = preço médio ESTADUAL oficial da ANP (aba Estados), com média mensal própria; nunca é derivado do NE nem do NE/NO.",
  "Variações e diferenças de BA, NE e NO são calculadas sobre o preço da própria localidade (para comparação); o gatilho e os marcos seguem o NE/NO.",
  "Diferença mensal = preço do mês − preço do mês anterior; variação mensal = (preço do mês / preço do mês anterior − 1) × 100.",
  "Variação acumulada = (preço do mês / preço do marco − 1) × 100; diferença acumulada = preço do mês − preço do marco (nunca soma de percentuais).",
  "Gatilho gerencial: variação acumulada ≥ +5% (aumento) ou ≤ −5% (redução), inclusive no limite.",
  "Ao atingir o gatilho, o próprio mês vira automaticamente o novo marco zero: a variação acumulada recomeça a partir do preço desse mês.",
  "Mês parcial enquanto não encerrado ou enquanto falta a pesquisa iniciada no último domingo do mês.",
];

// ============================================================ dados ANP (BA, NE, N e NE/NO)
export async function opcoes() {
  const [o, ultima] = await Promise.all([repo.opcoesAnp(), repo.ultimaAtualizacaoAnp()]);
  return {
    anos: o.anos.filter((a) => a >= 2026),
    fontes: o.fontes,
    ultima_atualizacao_anp: ultima,
    regioes: [{ sigla: "NE", nome: "Nordeste" }, { sigla: "N", nome: "Norte" }],
    estados: [{ sigla: "BA", nome: "Bahia" }],
    indicadores: { NENO: "Média NE/NO (gerencial)", BA: "Bahia", NE: "Nordeste", N: "Norte" },
    inicio_serie: INICIO_SERIE,
  };
}

export async function historicoSemanal(query) {
  const { de, ate } = validar(z.object({ de: dataIso.optional(), ate: dataIso.optional() }), query);
  return { semanas: await repo.listarSemanaisRegionais({ de: de && de > INICIO_SERIE ? de : INICIO_SERIE, ate }) };
}

export async function historicoMensal() {
  const { series, marcos, limite } = await carregarIndicadores();
  return { series, marcos, limite_gatilho_pct: limite };
}

const resumoMarco = (m) => (m ? { id: m.id, ref_ano: m.ref_ano, ref_mes: m.ref_mes, preco_referencia: m.preco_referencia, origem: m.origem, vigente: m.vigente, criado_em: m.criado_em, criado_por_nome: m.criado_por_nome, reajuste_id: m.reajuste_id, observacao: m.observacao } : null);

export async function dashboard(query) {
  const f = validar(filtroAno, query);
  const base = f.base || "NENO";
  const [{ series, marcos, vigente, limite }, ultima, [ultimoSync], ultimoOk, alertas, reajustes, gatilhos, tabelas] = await Promise.all([
    carregarIndicadores(), repo.ultimaAtualizacaoAnp(), repo.ultimosSyncLogs(1), repo.ultimoSyncOk(), repo.listarAlertas({ abertos: true, limit: 20 }),
    repo.listarReajustes(), repo.listarGatilhos({ status: "ABERTO" }), repo.listarTabelasFrete(),
  ]);
  const comum = {
    base, limite_gatilho_pct: limite, regras: REGRAS,
    ultima_atualizacao_anp: { ultima_semana: ultima?.ultima_semana || null, gravado_em: ultima?.gravado_em || null },
    ultima_sincronizacao: ultimoSync || null,
    atualizacao: { versao: ultimoOk ? String(ultimoOk.id) : null, ultima_sincronizacao_ok: ultimoOk, ...situacaoAtualizacao({ ultimaSemana: ultima?.ultima_semana, ultimoOk }) },
    alertas, gatilhos_abertos: gatilhos,
    regulatorio: await regulatorio(tabelas),
  };
  const neno = series.NENO;
  if (!neno.length) return { ...comum, sem_dados: true, series, marcos: marcos.map(resumoMarco) };
  const atual = neno.at(-1);
  const anterior = neno.length > 1 ? neno.at(-2) : null;
  const ano = f.ano || atual.ano;
  const ultimoReajuste = reajustes.find((r) => r.status === "APROVADO") || null;
  return {
    ...comum,
    sem_dados: false,
    ano,
    anos_disponiveis: [...new Set(neno.map((m) => m.ano))].sort((a, b) => b - a),
    indicadores: {
      preco_atual: atual,
      mes_anterior: anterior,
      variacao_mensal_pct: atual.variacao_mensal_pct,
      diferenca_mensal: atual.diferenca_mensal,
      data_ultimo_reajuste: ultimoReajuste ? ultimoReajuste.data_vigencia : null,
      precos_regionais: { BA: series.BA.at(-1) || null, NE: series.NE.at(-1) || null, N: series.N.at(-1) || null },
    },
    gerencial: { marco: resumoMarco(vigente), ...(situacaoAtual(neno, vigente, limite) || {}) },
    series,
    marcos: marcos.map(resumoMarco),
    tabela: tabelaPlanilha(series, ano, base),
  };
}

/** Indicador REGULATÓRIO: só o que foi cadastrado com fonte ANTT; nunca derivado do gatilho gerencial. */
async function regulatorio(tabelas) {
  const marcoReg = (await repo.listarMarcos({ tipo: "REGULATORIO" })).find((m) => m.vigente) || null;
  const hojeIso = hoje();
  const vigentes = tabelas
    .filter((t) => t.vigencia_inicio <= hojeIso && !t.vigencia_fim)
    .map((t) => ({ id: t.id, tabela: t.tabela, tipo_carga: t.tipo_carga, vigencia_inicio: t.vigencia_inicio, norma: t.norma, fonte_url: t.fonte_url }));
  return {
    aviso: "Indicador regulatório depende exclusivamente das publicações oficiais da ANTT cadastradas; não é alterado pelo gatilho gerencial.",
    marco_regulatorio: marcoReg,
    tabelas_vigentes: vigentes,
    total_tabelas_cadastradas: tabelas.length,
  };
}

// ============================================================ marcos e reajustes
// Marco GERENCIAL: sempre do indicador NE/NO e sempre a partir da média calculada de um mês (sem digitar preço).
// Marco REGULATORIO: referência informada com documento oficial da ANTT (não interfere no gerencial).
const marcoSchema = z.object({
  tipo: z.enum(["GERENCIAL", "REGULATORIO"]).default("GERENCIAL"),
  ref_ano: z.coerce.number().int().min(2026).max(2100),
  ref_mes: z.coerce.number().int().min(1).max(12),
  preco_referencia: z.union([z.string(), z.number()]).optional(),
  fonte_documento: z.string().trim().max(500).optional(),
  observacao: z.string().trim().max(500).optional(),
});

export async function criarMarco(input, userId, ip) {
  const m = validar(marcoSchema, input);
  const base = { ...COMBINADO, fonte: "ANP_RESUMO_SEMANAL", metodologia: "MEDIA_SIMPLES_SEMANAS" };
  let preco, origem;
  if (m.tipo === "GERENCIAL") {
    const serie = await repo.listarMensais(base);
    const mes = serie.find((x) => x.ano === m.ref_ano && x.mes === m.ref_mes);
    if (!mes) throw new HttpError(422, `Não há média NE/NO de ${String(m.ref_mes).padStart(2, "0")}/${m.ref_ano}. Sincronize os dados da ANP primeiro.`);
    if (!mes.mes_completo) throw new HttpError(422, "O mês selecionado ainda está parcial; escolha um mês encerrado.");
    if (!m.observacao || m.observacao.length < 5) throw bad("Informe o motivo da redefinição do marco (observação).");
    preco = mes.preco_medio;
    origem = "MES_DA_SERIE";
  } else {
    if (m.preco_referencia == null || m.preco_referencia === "" || !m.fonte_documento) throw bad("Marco regulatório exige preço informado e o documento/fonte oficial da ANTT.");
    try { preco = D.round(m.preco_referencia, 6); } catch { throw bad("Preço de referência inválido."); }
    if (D.parse(preco) <= 0n) throw bad("Preço de referência deve ser maior que zero.");
    origem = "PRECO_MANUAL";
  }
  const id = await repo.criarMarco({ ...base, tipo: m.tipo, ref_ano: m.ref_ano, ref_mes: m.ref_mes, preco_referencia: preco, origem, fonte_documento: m.fonte_documento, observacao: m.observacao, criado_por: userId });
  await repo.audit({ usuarioId: userId, acao: "MARCO_CRIADO", entidade: "antt_marcos", entidadeId: id, depois: { ...m, preco_referencia: preco, origem }, ip });
  if (m.tipo === "GERENCIAL") await recalcularIndicadores();
  return { id, preco_referencia: preco };
}

export async function listarMarcos(query) {
  return { marcos: await repo.listarMarcos({ tipo: query.tipo }) };
}

export async function listarGatilhos(query) {
  return { gatilhos: await repo.listarGatilhos({ status: query.status }) };
}

// Reajustes: o marco zero é automático (o mês que atinge o gatilho — ver antt/triggers.js). A DECISÃO da
// empresa sobre aplicar o reajuste é humana: registrarDecisaoReajuste grava quem decidiu, quando e a data de
// aplicação, sem alterar preços, cálculos nem o marco (que passa a ser fixo, imune a correções posteriores).
const decisaoSchema = z.object({
  marco_id: z.coerce.number().int().positive(),
  aplicado: z.boolean({ required_error: "informe se o reajuste foi aplicado" }),
  data_aplicacao: dataIso.optional().nullable(),
  percentual_aplicado: z.union([z.string(), z.number()]).optional().nullable(),
  observacao: z.string().trim().max(500).optional().nullable(),
  confirmar: z.literal(true, { errorMap: () => ({ message: "é necessária a confirmação explícita da decisão" }) }),
});

export async function registrarDecisaoReajuste(input, userId, ip) {
  const r = validar(decisaoSchema, input);
  if (r.aplicado && !r.data_aplicacao) throw bad("Informe a data de aplicação do reajuste.");
  const marcos = (await repo.listarMarcos({ tipo: "GERENCIAL", ...COMBINADO }))
    .sort((a, b) => (a.ref_ano * 12 + a.ref_mes) - (b.ref_ano * 12 + b.ref_mes) || a.id - b.id);
  const i = marcos.findIndex((m) => m.id === r.marco_id);
  const marco = marcos[i];
  if (!marco) throw new HttpError(404, "Marco não encontrado.");
  if (marco.origem !== "GATILHO_AUTOMATICO") throw new HttpError(422, "Só há decisão de reajuste para marcos criados por gatilho.");
  if (marco.reajuste_id) throw new HttpError(409, "A decisão sobre este gatilho já foi registrada.");
  const anterior = marcos[i - 1];
  if (!anterior) throw new HttpError(422, "Marco anterior não encontrado para apurar a variação.");
  let pct = null;
  if (r.percentual_aplicado != null && r.percentual_aplicado !== "") {
    try { pct = D.round(String(r.percentual_aplicado).replace(",", "."), 4); } catch { throw bad("Percentual aplicado inválido."); }
  }
  const variacao = D.variacaoPct(marco.preco_referencia, anterior.preco_referencia);
  const direcao = D.cmp(marco.preco_referencia, anterior.preco_referencia) >= 0 ? "ALTA" : "BAIXA";
  const evento = {
    marco_id: marco.id, novo_marco_id: marco.id, direcao, ref_ano: marco.ref_ano, ref_mes: marco.ref_mes,
    preco_apurado: marco.preco_referencia, preco_referencia: anterior.preco_referencia, variacao_pct: variacao,
    percentual_aplicado: r.aplicado ? pct : null, data_vigencia: r.aplicado ? r.data_aplicacao : hoje(),
    status: r.aplicado ? "APROVADO" : "REJEITADO",
    justificativa: r.observacao?.trim() || (r.aplicado ? "Reajuste aplicado." : "Reajuste não aplicado."),
  };
  const reajusteId = await repo.registrarDecisaoReajuste(evento, userId);
  await repo.resolverAlertaPorChave(`MARCO_AUTOMATICO:${marco.ref_ano}-${marco.ref_mes}`, userId);
  await repo.audit({ usuarioId: userId, acao: r.aplicado ? "REAJUSTE_APLICADO" : "REAJUSTE_NAO_APLICADO", entidade: "antt_reajustes", entidadeId: reajusteId, depois: { ...evento, aprovado_por: userId }, ip });
  return { reajusteId, ...evento };
}

export async function listarReajustes() { return { reajustes: await repo.listarReajustes() }; }
export async function listarAlertas(query) { return { alertas: await repo.listarAlertas({ abertos: query.todos !== "1" }) }; }
export async function resolverAlerta(id, userId, ip) {
  const alerta = (await repo.listarAlertas({ abertos: true, limit: 500 })).find((a) => a.id === Number(id));
  if (alerta && alerta.tipo.startsWith("GATILHO")) throw new HttpError(422, "Alertas de gatilho permanecem até a confirmação do reajuste ou o tratamento em Gatilhos e marcos.");
  const ok = await repo.resolverAlerta(Number(id), userId);
  if (!ok) throw new HttpError(404, "Alerta não encontrado ou já resolvido.");
  await repo.audit({ usuarioId: userId, acao: "ALERTA_RESOLVIDO", entidade: "antt_alertas", entidadeId: id, ip });
  return { ok: true };
}

// ============================================================ tabelas ANTT
const tabelaSchema = z.object({
  tabela: z.enum(["A", "B"]),
  tipo_carga: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{3,40}$/).default("CARGA_GERAL"),
  vigencia_inicio: dataIso,
  norma: z.string().trim().min(3).max(200),
  fonte_url: z.string().trim().url().max(500).refine((u) => /^https:\/\/([a-z0-9-]+\.)*gov\.br\//i.test(u), "a fonte deve ser uma URL oficial (gov.br)"),
  observacao: z.string().trim().max(500).optional(),
  itens: z.array(z.object({
    eixos: z.coerce.number().int().min(2).max(9),
    ccd: decimal("CCD"),
    cc: decimal("CC"),
  })).min(1, "informe ao menos uma linha de eixos"),
});

export async function criarTabelaFrete(input, userId, ip) {
  const t = validar(tabelaSchema, input);
  const eixos = t.itens.map((i) => i.eixos);
  if (new Set(eixos).size !== eixos.length) throw bad("Há quantidade de eixos repetida.");
  for (const i of t.itens) if (D.parse(i.ccd) <= 0n || D.parse(i.cc) < 0n) throw bad(`Coeficientes inválidos para ${i.eixos} eixos (CCD deve ser > 0 e CC ≥ 0).`);
  try {
    const id = await repo.criarTabelaFrete({ ...t, usuarioId: userId });
    await repo.audit({ usuarioId: userId, acao: "TABELA_ANTT_CRIADA", entidade: "antt_tabelas_frete", entidadeId: id, depois: t, ip });
    return { id };
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") throw new HttpError(409, "Já existe uma tabela com essa vigência para o mesmo tipo/carga. Cadastre uma nova vigência (versões anteriores são preservadas).");
    throw e;
  }
}
export async function listarTabelasFrete() { return { tabelas: await repo.listarTabelasFrete() }; }

// ============================================================ calculadora
const calcSchema = z.object({
  tabela: z.enum(["A", "B"]),
  tipo_carga: z.string().trim().toUpperCase().default("CARGA_GERAL"),
  eixos: z.coerce.number().int().min(2).max(9),
  distancia_km: z.union([z.string(), z.number()]),
  data_referencia: dataIso.optional(),
  ccd: z.union([z.string(), z.number()]).optional().nullable(),
  cc: z.union([z.string(), z.number()]).optional().nullable(),
  valor_diesel: z.union([z.string(), z.number()]).optional().nullable(),
  valor_praticado: z.union([z.string(), z.number()]).optional().nullable(),
  simular_ajuste: z.object({ valor: z.union([z.string(), z.number()]), modo: z.enum(Object.keys(MODOS_AJUSTE_CC)) }).optional().nullable(),
});
const vazio = (v) => v === undefined || v === null || v === "";

export async function calculadora(input) {
  const c = validar(calcSchema, input);
  try { if (D.parse(c.distancia_km) <= 0n) throw new Error(); } catch { throw bad("Informe uma distância válida (> 0 km)."); }
  const dataRef = c.data_referencia || hoje();
  const manual = !vazio(c.ccd) || !vazio(c.cc);
  if (manual && (vazio(c.ccd) || vazio(c.cc))) throw bad("Para coeficientes manuais, informe CCD e CC.");
  let coef, tabelaInfo = null;
  const tab = await repo.tabelaVigente(c.tabela, c.tipo_carga, dataRef);
  if (tab) {
    tabelaInfo = { id: tab.id, tabela: tab.tabela, tipo_carga: tab.tipo_carga, vigencia_inicio: tab.vigencia_inicio, norma: tab.norma, fonte_url: tab.fonte_url };
    const item = await repo.itemTabela(tab.id, c.eixos);
    if (item) coef = { ccd: item.ccd, cc: item.cc, origem: "TABELA_OFICIAL" };
  }
  if (manual) coef = { ccd: String(c.ccd), cc: String(c.cc), origem: "MANUAL_NAO_OFICIAL" };
  if (!coef) {
    throw new HttpError(404, tab
      ? `A tabela vigente (${tab.norma}) não possui coeficientes para ${c.eixos} eixos.`
      : `Não há tabela ANTT ${c.tabela} (${c.tipo_carga}) cadastrada com vigência em ${dataRef}. Cadastre os coeficientes oficiais em Configurações ou informe os coeficientes manualmente.`);
  }
  const cfg = await getConfig();
  const ajuste = c.simular_ajuste
    ? { valor: c.simular_ajuste.valor, modo: c.simular_ajuste.modo, confirmado: false }
    : { valor: cfg.ajuste_cc_valor, modo: cfg.ajuste_cc_modo || null, confirmado: cfg.ajuste_cc_confirmado };
  const calculo = calcularFrete({ distanciaKm: c.distancia_km, ccd: coef.ccd, cc: coef.cc, valorPraticado: c.valor_praticado }, ajuste);
  return {
    ...calculo,
    origem_coeficientes: coef.origem,
    oficial: coef.origem === "TABELA_OFICIAL" && !(calculo.ajuste && calculo.ajuste.situacao === "SIMULACAO_NAO_CONFIRMADA"),
    tabela: tabelaInfo,
    eixos: c.eixos,
    data_referencia: dataRef,
    diesel: vazio(c.valor_diesel) ? null : { valor_informado: D.round(c.valor_diesel, 4), nota: "Informativo: o piso ANTT usa os coeficientes publicados; o diesel não entra na fórmula." },
    formula: "Piso mínimo = (distância × CCD) + CC",
  };
}

// ============================================================ clientes / contratos / fretes
const clienteSchema = z.object({ nome: z.string().trim().min(2).max(160), documento: z.string().trim().max(20).optional() });
export async function criarCliente(input, userId, ip) {
  const c = validar(clienteSchema, input);
  try {
    const id = await repo.criarCliente({ ...c, usuarioId: userId });
    await repo.audit({ usuarioId: userId, acao: "CLIENTE_CRIADO", entidade: "antt_clientes", entidadeId: id, depois: c, ip });
    return { id };
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") throw new HttpError(409, "Já existe um cliente com esse nome.");
    throw e;
  }
}
export async function listarClientes() { return { clientes: await repo.listarClientes() }; }

const contratoSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  descricao: z.string().trim().min(2).max(200),
  elegibilidade: z.enum(["PENDENTE_CONFIRMACAO", "CONFIRMADA", "NAO_ELEGIVEL"]).default("PENDENTE_CONFIRMACAO"),
  data_aplicacao_reajuste: dataIso.optional().nullable(),
  aplicacao_confirmada: z.boolean().default(false),
  observacao: z.string().trim().max(500).optional(),
});
export async function criarContrato(input, userId, ip) {
  const c = validar(contratoSchema, input);
  if (!(await repo.clientePorId(c.cliente_id))) throw new HttpError(404, "Cliente não encontrado.");
  if (c.aplicacao_confirmada && !c.data_aplicacao_reajuste) throw bad("Informe a data de aplicação para confirmá-la.");
  const id = await repo.criarContrato({ ...c, usuarioId: userId });
  await repo.audit({ usuarioId: userId, acao: "CONTRATO_CRIADO", entidade: "antt_contratos", entidadeId: id, depois: c, ip });
  return { id };
}
export async function atualizarContrato(id, input, userId, ip) {
  const c = validar(contratoSchema.omit({ cliente_id: true }), input);
  const antes = await repo.contratoPorId(Number(id));
  if (!antes) throw new HttpError(404, "Contrato não encontrado.");
  if (c.aplicacao_confirmada && !c.data_aplicacao_reajuste) throw bad("Informe a data de aplicação para confirmá-la.");
  await repo.atualizarContrato(Number(id), c);
  await repo.audit({ usuarioId: userId, acao: "CONTRATO_ATUALIZADO", entidade: "antt_contratos", entidadeId: id, antes, depois: c, ip });
  return { ok: true };
}
export async function listarContratos(query) { return { contratos: await repo.listarContratos(query.cliente_id ? Number(query.cliente_id) : null) }; }

const freteSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  contrato_id: z.coerce.number().int().positive().optional().nullable(),
  identificacao: z.string().trim().min(1).max(60),
  data_frete: dataIso,
  km: z.union([z.string(), z.number()]),
  valor_cobrado: z.union([z.string(), z.number()]),
  tabela: z.enum(["A", "B"]).optional().nullable(),
  tipo_carga: z.string().trim().toUpperCase().default("CARGA_GERAL"),
  eixos: z.coerce.number().int().min(2).max(9).optional().nullable(),
  ccd_aplicado: z.union([z.string(), z.number()]).optional().nullable(),
  cc_aplicado: z.union([z.string(), z.number()]).optional().nullable(),
});

function normalizarFrete(f) {
  const out = validar(freteSchema, f);
  out.km = D.round(out.km, 2); out.valor_cobrado = D.round(out.valor_cobrado, 2);
  if (D.parse(out.km) <= 0n) throw bad("km deve ser maior que zero.");
  if (D.parse(out.valor_cobrado) < 0n) throw bad("valor cobrado não pode ser negativo.");
  out.ccd_aplicado = vazio(out.ccd_aplicado) ? null : D.round(out.ccd_aplicado, 6);
  out.cc_aplicado = vazio(out.cc_aplicado) ? null : D.round(out.cc_aplicado, 6);
  return out;
}

export async function criarFrete(input, userId, ip) {
  const f = normalizarFrete(input);
  if (!(await repo.clientePorId(f.cliente_id))) throw new HttpError(404, "Cliente não encontrado.");
  const r = await repo.inserirFretes([f], userId);
  if (!r.inseridos) throw new HttpError(409, "Já existe frete com essa identificação para o cliente.");
  await repo.audit({ usuarioId: userId, acao: "FRETE_CRIADO", entidade: "antt_fretes", depois: f, ip });
  return r;
}

export async function listarFretes(query) {
  const q = validar(z.object({ cliente_id: z.coerce.number().int().positive().optional(), de: dataIso.optional(), ate: dataIso.optional() }), query);
  return { fretes: await repo.listarFretes({ clienteId: q.cliente_id, de: q.de, ate: q.ate }) };
}

// -- importação de fretes (CSV/XLSX) --
const ALIAS = {
  identificacao: ["identificacao", "conhecimento", "cte", "ct-e", "numero do conhecimento", "viagem", "numero", "documento"],
  data_frete: ["data", "data frete", "data do frete", "data_frete", "emissao"],
  km: ["km", "quilometragem", "distancia", "distancia km", "km percorridos"],
  valor_cobrado: ["valor", "valor cobrado", "valor_cobrado", "frete", "valor do frete", "valor original"],
  eixos: ["eixos", "numero de eixos"],
  tabela: ["tabela"],
  ccd_aplicado: ["ccd", "coeficiente km", "ccd aplicado"],
  cc_aplicado: ["cc", "coeficiente fixo", "cc aplicado"],
};
function dataFlex(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
async function lerTabelaGenerica(buffer, nome) {
  const xlsx = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (xlsx || /\.xlsx$/i.test(nome || "")) {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0]; if (!ws) throw bad("Planilha vazia.");
    const linhas = [];
    ws.eachRow({ includeEmpty: false }, (row) => linhas.push(Array.from(row.values, (v) => (v && typeof v === "object" && !(v instanceof Date) ? (v.result ?? v.text ?? "") : v)).slice(1)));
    return linhas;
  }
  const texto = decodificarTexto(buffer);
  const primeira = texto.split(/\r?\n/)[0] || "";
  return parseCsv(texto, (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ";" : ",");
}

export async function importarFretes({ buffer, nome, clienteId, contratoId }, userId, ip) {
  const cliente = await repo.clientePorId(Number(clienteId));
  if (!cliente) throw new HttpError(404, "Cliente não encontrado.");
  const linhas = await lerTabelaGenerica(buffer, nome);
  if (linhas.length < 2) throw bad("O arquivo não contém linhas de dados.");
  const header = linhas[0].map((h) => norm(h).toLowerCase());
  const col = Object.fromEntries(Object.entries(ALIAS).map(([k, nomes]) => [k, header.findIndex((h) => nomes.includes(h))]));
  for (const obrig of ["identificacao", "data_frete", "km", "valor_cobrado"]) {
    if (col[obrig] < 0) throw bad(`Coluna obrigatória não encontrada: ${obrig} (aceitos: ${ALIAS[obrig].join(", ")}).`);
  }
  const validos = [], rejeitados = [];
  linhas.slice(1).forEach((l, i) => {
    const get = (k) => (col[k] >= 0 ? l[col[k]] : undefined);
    try {
      validos.push(normalizarFrete({
        cliente_id: cliente.id, contrato_id: contratoId ? Number(contratoId) : null,
        identificacao: String(get("identificacao") ?? "").trim(), data_frete: dataFlex(get("data_frete")) || "invalida",
        km: get("km"), valor_cobrado: get("valor_cobrado"),
        eixos: vazio(get("eixos")) ? null : get("eixos"), tabela: vazio(get("tabela")) ? null : String(get("tabela")).trim().toUpperCase(),
        ccd_aplicado: get("ccd_aplicado"), cc_aplicado: get("cc_aplicado"),
      }));
    } catch (e) { rejeitados.push({ linha: i + 2, motivo: e.message }); }
  });
  const ident = new Set(); const unicos = [];
  for (const f of validos) { if (ident.has(f.identificacao)) rejeitados.push({ linha: null, motivo: `Identificação repetida no arquivo: ${f.identificacao}` }); else { ident.add(f.identificacao); unicos.push(f); } }
  const r = await repo.inserirFretes(unicos, userId);
  await repo.audit({ usuarioId: userId, acao: "FRETES_IMPORTADOS", entidade: "antt_fretes", depois: { arquivo: nome, cliente_id: cliente.id, ...r, rejeitados: rejeitados.length }, ip });
  return { ...r, rejeitados: rejeitados.slice(0, 50), total_rejeitados: rejeitados.length };
}

// ============================================================ retroativos
const retroSchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  contrato_id: z.coerce.number().int().positive().optional().nullable(),
  periodo_inicio: dataIso,
  periodo_fim: dataIso,
  data_vigencia_reajuste: dataIso.optional().nullable(),
  tabela_nova_id: z.coerce.number().int().positive(),
  eixos_padrao: z.coerce.number().int().min(2).max(9).optional().nullable(),
  apenas_positivas: z.boolean().default(false),
  observacao: z.string().trim().max(500).optional(),
  salvar: z.boolean().default(false),
});

export async function calcularRetroativos(input, userId, ip) {
  const p = validar(retroSchema, input);
  if (p.periodo_fim < p.periodo_inicio) throw bad("Período final anterior ao inicial.");
  const cliente = await repo.clientePorId(p.cliente_id);
  if (!cliente) throw new HttpError(404, "Cliente não encontrado.");
  const tabelaNova = await repo.tabelaPorId(p.tabela_nova_id);
  if (!tabelaNova) throw new HttpError(404, "Tabela ANTT (nova vigência) não encontrada.");
  const contrato = p.contrato_id ? await repo.contratoPorId(p.contrato_id) : null;
  if (p.contrato_id && (!contrato || contrato.cliente_id !== p.cliente_id)) throw new HttpError(404, "Contrato não encontrado para o cliente.");
  const dataVigencia = p.data_vigencia_reajuste || contrato?.data_aplicacao_reajuste || tabelaNova.vigencia_inicio;

  let fretes = await repo.listarFretes({ clienteId: p.cliente_id, de: p.periodo_inicio, ate: p.periodo_fim, limit: 20000 });
  if (contrato) fretes = fretes.filter((f) => f.contrato_id === contrato.id);
  fretes.sort((a, b) => a.data_frete.localeCompare(b.data_frete) || a.identificacao.localeCompare(b.identificacao));

  // Coeficientes novos por nº de eixos (tabela nova) e originais (versão vigente na data do frete), pré-carregados.
  // Coeficientes ORIGINAIS: os gravados no frete ou, na falta, os da versão da mesma tabela imediatamente
  // anterior à nova (vigente no dia anterior ao início da nova). Se não existir, não há decomposição do efeito.
  const cacheNovo = new Map(), cacheOrig = new Map();
  const eixosDe = (f) => f.eixos || p.eixos_padrao || null;
  const eixosUsados = [...new Set(fretes.map(eixosDe).filter(Boolean))];
  const diaAnterior = new Date(`${tabelaNova.vigencia_inicio}T00:00:00Z`); diaAnterior.setUTCDate(diaAnterior.getUTCDate() - 1);
  const tabelaAnterior = await repo.tabelaVigente(tabelaNova.tabela, tabelaNova.tipo_carga, diaAnterior.toISOString().slice(0, 10));
  for (const e of eixosUsados) {
    cacheNovo.set(e, await repo.itemTabela(tabelaNova.id, e));
    cacheOrig.set(e, tabelaAnterior ? await repo.itemTabela(tabelaAnterior.id, e) : null);
  }
  const calculo = calcularRetroativo({
    fretes, dataVigencia, periodoInicio: p.periodo_inicio, periodoFim: p.periodo_fim, apenasPositivas: p.apenas_positivas,
    coefNovosFn: (f) => { const it = cacheNovo.get(eixosDe(f)); return it ? { ccd: it.ccd, cc: it.cc } : null; },
    coefOriginaisFn: (f) => {
      if (f.ccd_aplicado != null && f.cc_aplicado != null) return { ccd: f.ccd_aplicado, cc: f.cc_aplicado };
      const it = cacheOrig.get(eixosDe(f));
      return it ? { ccd: it.ccd, cc: it.cc } : null;
    },
  });
  const confirmado = Boolean(contrato && contrato.elegibilidade === "CONFIRMADA" && contrato.aplicacao_confirmada && contrato.data_aplicacao_reajuste === dataVigencia);
  const status = confirmado ? "CONFIRMADO" : "ESTIMADO";
  const resposta = {
    status,
    aviso: status === "ESTIMADO" ? "VALORES RETROATIVOS ESTIMADOS — a elegibilidade contratual e a data correta de aplicação do reajuste ainda não foram confirmadas." : null,
    cliente, contrato, data_vigencia_reajuste: dataVigencia, periodo: { inicio: p.periodo_inicio, fim: p.periodo_fim },
    tabela_nova: tabelaNova, apenas_positivas: p.apenas_positivas, ...calculo,
  };
  if (p.salvar) {
    if (!calculo.itens.length) throw new HttpError(422, "Nenhum frete elegível no período para salvar.");
    const id = await repo.salvarRetroativo({
      cabecalho: { cliente_id: p.cliente_id, contrato_id: p.contrato_id, periodo_inicio: p.periodo_inicio, periodo_fim: p.periodo_fim,
        data_vigencia_reajuste: dataVigencia, tabela_nova_id: p.tabela_nova_id, apenas_positivas: p.apenas_positivas, status, observacao: p.observacao, usuarioId: userId },
      itens: calculo.itens, resumo: calculo.resumo,
    });
    await repo.audit({ usuarioId: userId, acao: "RETROATIVO_SALVO", entidade: "antt_retroativos", entidadeId: id, depois: { ...calculo.resumo, status }, ip });
    resposta.id = id;
  }
  return resposta;
}

export async function listarRetroativos() { return { retroativos: await repo.listarRetroativos() }; }
export async function obterRetroativo(id) {
  const r = await repo.obterRetroativo(Number(id));
  if (!r) throw new HttpError(404, "Cálculo não encontrado.");
  return r;
}

export async function exportarRetroativoXlsx(id, userId, ip) {
  const r = await obterRetroativo(id);
  const num = (v) => (v === null || v === undefined ? null : Number(v));
  const wb = new ExcelJS.Workbook();
  wb.creator = "JTD Transportes — Módulo ANTT"; wb.created = new Date();
  const resumo = wb.addWorksheet("Resumo");
  resumo.columns = [{ width: 38 }, { width: 46 }];
  if (r.status === "ESTIMADO") {
    resumo.addRow(["RETROATIVOS ESTIMADOS — pendente confirmação de elegibilidade contratual e da data de aplicação"]);
    resumo.mergeCells("A1:B1");
    resumo.getRow(1).font = { bold: true, color: { argb: "FFB00020" } };
    resumo.getRow(1).alignment = { wrapText: true }; resumo.getRow(1).height = 32;
  }
  const linhas = [
    ["Cliente", r.cliente_nome], ["Período dos fretes", `${r.periodo_inicio} a ${r.periodo_fim}`],
    ["Vigência do reajuste", r.data_vigencia_reajuste],
    ["Tabela ANTT", `${r.tabela} — ${r.tipo_carga} (vigência ${r.tabela_vigencia})`], ["Norma", r.norma], ["Fonte oficial", r.fonte_url],
    ["Status", r.status], ["Somente diferenças positivas", r.apenas_positivas ? "Sim" : "Não"],
    ["Quantidade de fretes", r.qtd_fretes], ["Quilometragem total", num(r.km_total)], ["Média de km por viagem", num(r.km_medio)],
    ["Valor total cobrado (R$)", num(r.total_cobrado)], ["Valor recalculado (R$)", num(r.total_recalculado)],
    ["Valor retroativo total (R$)", num(r.total_retroativo)], ["Gerado em", new Date().toISOString().slice(0, 19).replace("T", " ")],
  ];
  linhas.forEach((l) => { const row = resumo.addRow(l); row.getCell(1).font = { bold: true }; });
  const money = '#,##0.00';
  for (let i = 1; i <= resumo.rowCount; i++) {
    const c = resumo.getRow(i).getCell(2);
    if (typeof c.value === "number" && i > 1) c.numFmt = money;
  }
  const ws = wb.addWorksheet("Fretes");
  ws.columns = [
    { header: "Identificação", key: "identificacao", width: 22 }, { header: "Data", key: "data_frete", width: 12 },
    { header: "Km", key: "km", width: 10 }, { header: "Valor cobrado", key: "valor_cobrado", width: 15 },
    { header: "CCD original (R$/km)", key: "ccd_original", width: 18 }, { header: "CC original (R$)", key: "cc_original", width: 16 },
    { header: "CCD novo (R$/km)", key: "ccd_novo", width: 16 }, { header: "CC novo (R$)", key: "cc_novo", width: 14 },
    { header: "Valor recalculado", key: "valor_recalculado", width: 17 }, { header: "Diferença", key: "diferenca", width: 14 },
    { header: "Efeito CCD (R$)", key: "efeito_ccd", width: 15 }, { header: "Efeito CC (R$)", key: "efeito_cc", width: 15 },
  ];
  ws.getRow(1).font = { bold: true }; ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E6EF" } };
  for (const i of r.itens) {
    ws.addRow({ ...i, km: num(i.km), valor_cobrado: num(i.valor_cobrado), ccd_original: num(i.ccd_original), cc_original: num(i.cc_original),
      ccd_novo: num(i.ccd_novo), cc_novo: num(i.cc_novo), valor_recalculado: num(i.valor_recalculado), diferenca: num(i.diferenca),
      efeito_ccd: num(i.efeito_ccd), efeito_cc: num(i.efeito_cc) });
  }
  const tot = ws.addRow({ identificacao: "TOTAL", km: num(r.km_total), valor_cobrado: num(r.total_cobrado), valor_recalculado: num(r.total_recalculado), diferenca: num(r.total_retroativo) });
  tot.font = { bold: true };
  ["km", "valor_cobrado", "valor_recalculado", "diferenca", "efeito_ccd", "efeito_cc", "cc_original", "cc_novo"].forEach((k) => { ws.getColumn(k).numFmt = money; });
  ["ccd_original", "ccd_novo"].forEach((k) => { ws.getColumn(k).numFmt = "0.0000"; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  await repo.audit({ usuarioId: userId, acao: "RETROATIVO_EXPORTADO", entidade: "antt_retroativos", entidadeId: id, ip });
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), nome: `retroativos-${r.cliente_nome.replace(/[^A-Za-z0-9]+/g, "_")}-${r.id}.xlsx` };
}

export async function listarAuditoria() { return { auditoria: await repo.listarAuditoria(200) }; }
/**
 * Dados desatualizados? (só monitoramento; não altera nada)
 *  - nenhuma sincronização bem-sucedida, ou a última foi há mais de 36 h (o agendador roda a cada 6 h);
 *  - ou a última pesquisa importada terminou há mais de 13 dias (a ANP publica toda semana).
 */
export function situacaoAtualizacao({ ultimaSemana, ultimoOk, agora = new Date() }) {
  if (!ultimoOk) return { desatualizado: true, motivo: "Ainda não houve sincronização bem-sucedida com a ANP." };
  const horas = (agora - new Date(ultimoOk.finalizado_em || ultimoOk.iniciado_em)) / 3600000;
  if (horas > 36) return { desatualizado: true, motivo: `A última sincronização bem-sucedida foi há ${Math.floor(horas / 24)} dia(s).` };
  if (ultimaSemana) {
    const dias = (agora - new Date(`${ultimaSemana}T23:59:59Z`)) / 86400000;
    if (dias > 13) return { desatualizado: true, motivo: `A pesquisa mais recente da ANP importada terminou há ${Math.floor(dias)} dias.` };
  }
  return { desatualizado: false, motivo: null };
}

/** Consulta leve para a tela perceber uma sincronização nova e se atualizar sozinha. */
export async function versaoDados() {
  const [ok, ultima] = await Promise.all([repo.ultimoSyncOk(), repo.ultimaAtualizacaoAnp()]);
  return { versao: ok ? String(ok.id) : null, ultima_sincronizacao_ok: ok, ultima_semana: ultima?.ultima_semana || null, ...situacaoAtualizacao({ ultimaSemana: ultima?.ultima_semana, ultimoOk: ok }) };
}

export async function statusSync() {
  const [ult, logs, ultima] = [await repo.ultimosSyncLogs(1), await repo.ultimosSyncLogs(10), await repo.ultimaAtualizacaoAnp()];
  return { ultimo: ult[0] || null, historico: logs, ultima_atualizacao_anp: ultima };
}
export { distanciaGatilhos };
