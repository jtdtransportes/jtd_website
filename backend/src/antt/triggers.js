// Indicadores gerenciais NE/NO (planilha da empresa): recálculo, marco inicial automático e marcos zero automáticos.
// Este indicador é GERENCIAL e não altera nem substitui a regra oficial/regulatória da ANTT.
// Regra: o mês que atinge ≥ +L% ou ≤ −L% contra o marco em vigor vira automaticamente o novo marco zero.
import repo from "../repositories/antt.repository.js";
import { getConfig } from "./config.js";
import * as D from "./decimal.js";
import {
  COMBINADO, INICIO_SERIE, cadeiaMarcosAutomaticos, distanciaGatilhos, marcosParaRegiao, mediaCombinada, mediasMensais, serieIndicador,
} from "./anpCalc.js";

export const ROTULO_MES = (ano, mes) => `${String(mes).padStart(2, "0")}/${ano}`;
const BASE = { fonte: "ANP_RESUMO_SEMANAL", metodologia: "MEDIA_SIMPLES_SEMANAS" };
const brl = (v, casas = 4) => `R$ ${Number(v).toFixed(casas).replace(".", ",")}`;
const pct = (v) => `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2).replace(".", ",")}%`;

/** Marcos gerenciais do indicador NE/NO (todos, inclusive encerrados — formam a linha do tempo). */
export async function marcosGerenciais() {
  return repo.listarMarcos({ tipo: "GERENCIAL", escopo: COMBINADO.escopo, chave: COMBINADO.chave });
}

/** Lê as médias mensais persistidas e monta as quatro séries (BA, NE, N, NE/NO) com diferenças, variações e gatilhos. */
export async function carregarIndicadores() {
  const cfg = await getConfig();
  const limite = cfg.limite_gatilho_pct;
  const [ba, ne, n, neno, marcos] = await Promise.all([
    repo.listarMensais({ escopo: "ESTADO", chave: "BA", ...BASE }),
    repo.listarMensais({ escopo: "REGIAO", chave: "NE", ...BASE }),
    repo.listarMensais({ escopo: "REGIAO", chave: "N", ...BASE }),
    repo.listarMensais({ ...COMBINADO, ...BASE }),
    marcosGerenciais(),
  ]);
  const timeline = marcos.map((m) => ({ id: m.id, ref_ano: m.ref_ano, ref_mes: m.ref_mes, preco_referencia: m.preco_referencia }));
  const series = {
    NENO: serieIndicador(neno, timeline, limite),
    // BA, NE e N: mesmos meses de marco do NE/NO, com o preço da PRÓPRIA localidade (só comparação; o gatilho é o NE/NO)
    BA: serieIndicador(ba, marcosParaRegiao(timeline, ba), limite),
    NE: serieIndicador(ne, marcosParaRegiao(timeline, ne), limite),
    N: serieIndicador(n, marcosParaRegiao(timeline, n), limite),
  };
  return { series, marcos, vigente: marcos.find((m) => m.vigente) || null, limite };
}

/** Situação atual do indicador NE/NO contra o marco vigente. */
export function situacaoAtual(serieNENO, vigente, limite) {
  if (!vigente || !serieNENO.length) return null;
  const atual = serieNENO.at(-1);
  return {
    atual,
    ultimo_mes_completo: [...serieNENO].reverse().find((m) => m.mes_completo) || null,
    ...distanciaGatilhos(atual.preco_medio, vigente.preco_referencia, limite),
  };
}

/** Marco inicial automático = média NE/NO de janeiro/2026 (sem digitação de preço). */
export async function garantirMarcoInicial(mesesNENO) {
  const [anoIni, mesIni] = INICIO_SERIE.split("-").map(Number);
  const jan = mesesNENO.find((m) => m.ano === anoIni && m.mes === mesIni);
  if (!jan) return { acao: "AGUARDANDO_DADOS_JANEIRO" };
  const marcos = await marcosGerenciais();
  if (!marcos.length) {
    const id = await repo.criarMarco({
      tipo: "GERENCIAL", ...COMBINADO, ...BASE, ref_ano: anoIni, ref_mes: mesIni, preco_referencia: jan.preco_medio,
      origem: "INICIAL_AUTOMATICO", observacao: "Marco inicial automático: média NE/NO de janeiro/2026 (ANP, Diesel S10).",
    });
    await repo.audit({ acao: "MARCO_INICIAL_AUTOMATICO", entidade: "antt_marcos", entidadeId: id, depois: { ref: "2026-01", preco_referencia: jan.preco_medio } });
    return { acao: "CRIADO", id, preco: jan.preco_medio };
  }
  // O marco automático acompanha a média de janeiro se a ANP corrigir alguma semana do mês.
  for (const m of marcos.filter((x) => x.origem === "INICIAL_AUTOMATICO")) {
    if (D.cmp(m.preco_referencia, jan.preco_medio) !== 0) {
      await repo.atualizarPrecoMarco(m.id, jan.preco_medio);
      await repo.audit({ acao: "MARCO_INICIAL_RECALCULADO", entidade: "antt_marcos", entidadeId: m.id, antes: { preco_referencia: m.preco_referencia }, depois: { preco_referencia: jan.preco_medio } });
      return { acao: "ATUALIZADO", id: m.id, preco: jan.preco_medio };
    }
  }
  return { acao: "MANTIDO" };
}

const chaveMarco = (m) => `${m.ref_ano}-${m.ref_mes}`;

function observacaoAutomatica(d) {
  return `Marco zero automático: média NE/NO de ${ROTULO_MES(d.ref_ano, d.ref_mes)}${d.mes_parcial ? " (mês parcial)" : ""} ` +
    `${pct(d.variacao_pct)} sobre o marco de ${ROTULO_MES(d.anterior.ref_ano, d.anterior.ref_mes)} (${brl(d.anterior.preco_referencia)}) — ` +
    `gatilho de ${d.direcao === "ALTA" ? "aumento" : "redução"}.`;
}

function alertaMarcoAutomatico(id, d) {
  return {
    alert_key: `MARCO_AUTOMATICO:${chaveMarco(d)}`,
    tipo: "MARCO_AUTOMATICO",
    severidade: "INFO",
    titulo: `Novo marco zero: ${ROTULO_MES(d.ref_ano, d.ref_mes)} (gatilho de ${d.direcao === "ALTA" ? "aumento" : "redução"})`,
    mensagem: `Diesel S10 — média NE/NO de ${ROTULO_MES(d.ref_ano, d.ref_mes)}: ${brl(d.preco_referencia)} contra o marco de ` +
      `${ROTULO_MES(d.anterior.ref_ano, d.anterior.ref_mes)} (${brl(d.anterior.preco_referencia)}) = ${pct(d.variacao_pct)}. ` +
      `${ROTULO_MES(d.ref_ano, d.ref_mes)} passou a ser o novo marco zero e a variação acumulada recomeça a partir dele.` +
      (d.mes_parcial ? " Mês ainda parcial: o marco acompanha as próximas pesquisas da ANP." : ""),
    marco_id: id, ref_ano: d.ref_ano, ref_mes: d.ref_mes, variacao_pct: d.variacao_pct,
  };
}

/**
 * Recalcula do zero a cadeia de marcos automáticos sobre a série NE/NO e sincroniza com o banco:
 * cria os novos (com aviso informativo no dashboard), atualiza preço dos que mudaram (ex.: mês parcial)
 * e remove os que uma correção da ANP eliminou. O marco de referência mais recente fica vigente.
 */
export async function aplicarMarcosAutomaticos(mesesNENO, limite) {
  const marcos = await marcosGerenciais();
  if (!marcos.length) return { criados: [], atualizados: [], removidos: [] };
  // Marco automático com decisão registrada (reajuste_id) é fixo: funciona como âncora e não é recalculado.
  const decidido = (m) => m.origem === "GATILHO_AUTOMATICO" && m.reajuste_id != null;
  const ancoras = marcos.filter((m) => m.origem !== "GATILHO_AUTOMATICO" || decidido(m));
  const existentes = marcos.filter((m) => m.origem === "GATILHO_AUTOMATICO" && !decidido(m));
  const desejados = cadeiaMarcosAutomaticos(mesesNENO, ancoras, limite);

  const porMes = new Map(existentes.map((m) => [chaveMarco(m), m]));
  const mantidos = new Set();
  const inserir = [], atualizar = [], alertasAtualizar = [];
  for (const d of desejados) {
    const observacao = observacaoAutomatica(d);
    const e = porMes.get(chaveMarco(d));
    if (!e) { inserir.push({ ...BASE, ref_ano: d.ref_ano, ref_mes: d.ref_mes, preco_referencia: d.preco_referencia, observacao, d }); continue; }
    mantidos.add(e.id);
    if (D.cmp(e.preco_referencia, d.preco_referencia) !== 0 || e.observacao !== observacao) {
      atualizar.push({ id: e.id, preco_referencia: d.preco_referencia, observacao });
      alertasAtualizar.push([e.id, d]);
    }
  }
  const removidos = existentes.filter((e) => !mantidos.has(e.id));

  const { criados } = await repo.sincronizarMarcosAutomaticos({
    tipo: "GERENCIAL", ...COMBINADO, remover: removidos.map((e) => e.id), inserir: inserir.map(({ d, ...m }) => m), atualizar,
  });

  for (const [i, novo] of inserir.entries()) {
    await repo.registrarAlerta(alertaMarcoAutomatico(criados[i], novo.d));
    await repo.audit({ acao: "MARCO_ZERO_AUTOMATICO", entidade: "antt_marcos", entidadeId: criados[i], depois: { ref: chaveMarco(novo.d), preco_referencia: novo.d.preco_referencia, variacao_pct: novo.d.variacao_pct, direcao: novo.d.direcao } });
  }
  for (const [id, d] of alertasAtualizar) await repo.registrarAlerta(alertaMarcoAutomatico(id, d));
  for (const e of removidos) {
    await repo.resolverAlertaPorChave(`MARCO_AUTOMATICO:${chaveMarco(e)}`);
    await repo.audit({ acao: "MARCO_ZERO_AUTOMATICO_REMOVIDO", entidade: "antt_marcos", entidadeId: e.id, antes: { ref: chaveMarco(e), preco_referencia: e.preco_referencia }, depois: { motivo: "Correção dos dados da ANP: o mês deixou de atingir o gatilho." } });
  }
  return {
    criados: inserir.map((x) => ROTULO_MES(x.ref_ano, x.ref_mes)),
    atualizados: atualizar.length,
    removidos: removidos.map((e) => ROTULO_MES(e.ref_ano, e.ref_mes)),
  };
}

/** Gatilhos abertos da regra antiga (confirmação manual) deixam de esperar decisão: o mês virou marco zero. */
async function encerrarGatilhosLegados() {
  const ids = await repo.encerrarGatilhosAbertos();
  for (const id of ids) await repo.resolverAlertaPorChave(`GATILHO:${id}`);
  return ids.length;
}

/**
 * Recalcula tudo a partir das semanas gravadas: médias mensais BA/NE/N, média NE/NO, marco inicial e
 * marcos zero automáticos. Chamado após cada sincronização/importação — assim correções de semanas já
 * publicadas propagam automaticamente para os meses, marcos e indicadores afetados.
 */
export async function recalcularIndicadores({ hoje = new Date().toISOString().slice(0, 10) } = {}) {
  const semanas = await repo.listarSemanaisRegionais({ de: INICIO_SERIE });
  const ba = mediasMensais(semanas.filter((s) => s.escopo === "ESTADO" && s.chave === "BA"), { hoje });
  const ne = mediasMensais(semanas.filter((s) => s.escopo === "REGIAO" && s.chave === "NE"), { hoje });
  const n = mediasMensais(semanas.filter((s) => s.escopo === "REGIAO" && s.chave === "N"), { hoje });
  const neno = mediaCombinada(ne, n);
  await repo.substituirMensais([
    ...ba.map((m) => ({ ...m, escopo: "ESTADO", chave: "BA" })),
    ...ne.map((m) => ({ ...m, escopo: "REGIAO", chave: "NE" })),
    ...n.map((m) => ({ ...m, escopo: "REGIAO", chave: "N" })),
    ...neno.map((m) => ({ ...m, ...COMBINADO })),
  ]);
  const marcoInicial = await garantirMarcoInicial(neno);
  const { limite_gatilho_pct: limite } = await getConfig();
  const marcosAutomaticos = await aplicarMarcosAutomaticos(neno, limite);
  const gatilhosLegadosEncerrados = await encerrarGatilhosLegados();
  return {
    semanas: semanas.length, meses: { BA: ba.length, NE: ne.length, N: n.length, NENO: neno.length },
    marco_inicial: marcoInicial, marcos_automaticos: marcosAutomaticos, gatilhos_legados_encerrados: gatilhosLegadosEncerrados,
  };
}
