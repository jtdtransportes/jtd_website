// Cálculos puros (sem banco) que reproduzem a planilha de acompanhamento NE/NO do Diesel S10.
//
// REGRAS DOCUMENTADAS
// 1. Fonte: preço médio de revenda oficial da ANP (levantamento semanal), Diesel S10, semanas com data
//    inicial a partir de 01/01/2026: regiões Norte (N) e Nordeste (NE) e o ESTADO da Bahia (BA, aba ESTADOS
//    da própria ANP — nunca derivado de NE ou de NE/NO).
// 2. Semana → mês: a semana pertence ao mês da sua DATA INICIAL (início da pesquisa).
//    Ex.: pesquisa 29/03–04/04 conta em março; 28/12/2025–03/01/2026 fica em dez/2025 (fora da série).
// 3. Média mensal de cada localidade (BA, NE, N) = média aritmética simples dos seus preços médios semanais no mês.
// 4. Média NE/NO = (média mensal NE + média mensal NO) / 2. Indicador GERENCIAL da empresa, que
//    reproduz a planilha; NÃO é uma média oficial ponderada da ANP.
// 5. Mês parcial: enquanto o mês não terminou ou ainda falta importar a pesquisa iniciada no último
//    domingo do mês (tolerância de 14 dias após o fim do mês, caso a ANP não publique essa semana).
// 6. Diferença mensal (R$/L) = preço do mês − preço do mês anterior (somente meses consecutivos).
//    Variação mensal (%) = ((preço do mês / preço do mês anterior) − 1) × 100.
// 7. Variação acumulada (%) = ((preço do mês / preço do marco) − 1) × 100 — razão direta contra o
//    marco, nunca soma de percentuais mensais. Diferença acumulada (R$/L) = preço do mês − preço do marco.
// 8. Marco aplicável a um mês = o marco criado por último (maior id) cuja referência é ≤ o mês.
//    Um novo marco zera o acumulado a partir do seu mês de referência; os anteriores continuam valendo
//    para os meses anteriores (histórico preservado).
// 9. Gatilho gerencial: variação acumulada ≥ +L% → ALTA; ≤ −L% → BAIXA (L padrão = 5, inclusivo).
import * as D from "./decimal.js";

export const INICIO_SERIE = "2026-01-01";
export const REGIOES_ALVO = ["NE", "N"];
/** Localidades importadas da ANP (cada uma com média mensal e indicadores próprios). */
export const LOCALIDADES = [
  { escopo: "ESTADO", chave: "BA", nome: "Bahia" },
  { escopo: "REGIAO", chave: "NE", nome: "Nordeste" },
  { escopo: "REGIAO", chave: "N", nome: "Norte" },
];
export const ehLocalidade = (s, chave) => LOCALIDADES.some((l) => l.escopo === s.escopo && l.chave === s.chave && (!chave || l.chave === chave));
export const COMBINADO = { escopo: "COMBINADO", chave: "NENO" };
export const METODOLOGIAS = { MEDIA_SIMPLES_SEMANAS: "Média aritmética simples dos preços médios semanais regionais" };
export const NOMES_MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
const utc = (s) => { const [y, m, d] = iso(s).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDias = (s, n) => { const d = utc(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const idxMes = (ano, mes) => ano * 12 + (mes - 1);
const chaveMes = (ano, mes) => `${ano}-${String(mes).padStart(2, "0")}`;

/** Semana domingo→sábado que contém a data. */
export function semanaDe(dataIso) {
  const d = utc(dataIso);
  const inicio = addDias(iso(d), -d.getUTCDay());
  return { inicio, fim: addDias(inicio, 6) };
}

/** Regra 2: o mês da semana é o mês da data inicial da pesquisa. */
export function mesDaSemana(semanaInicio) {
  const d = utc(semanaInicio);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
}

export const ultimoDiaDoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
export function ultimoDomingoDoMes(ano, mes) {
  const fim = utc(ultimoDiaDoMes(ano, mes));
  return addDias(iso(fim), -fim.getUTCDay());
}

/** Regra 5. */
export function mesCompleto(ano, mes, iniciosImportados, hojeIso) {
  const ultimoDia = ultimoDiaDoMes(ano, mes);
  if (hojeIso <= ultimoDia) return false;
  if (iniciosImportados.includes(ultimoDomingoDoMes(ano, mes))) return true;
  return hojeIso > addDias(ultimoDia, 14);
}

/** Mantém apenas o escopo da planilha (estado BA e regiões NE/N, a partir de 2026). */
export function filtrarEscopo(semanais, inicio = INICIO_SERIE) {
  return semanais.filter((s) => ehLocalidade(s) && iso(s.semana_inicio) >= inicio);
}

/**
 * Regra 3. semanas: [{ semana_inicio, semana_fim, preco_medio, n_postos }] de UMA região.
 * Retorna [{ ano, mes, preco_medio (6 casas), exato (bigint), n_semanas, semanas, mes_completo }].
 */
export function mediasMensais(semanas, { hoje = new Date().toISOString().slice(0, 10) } = {}) {
  const grupos = new Map();
  for (const s of semanas) {
    const { ano, mes } = mesDaSemana(s.semana_inicio);
    const k = chaveMes(ano, mes);
    if (!grupos.has(k)) grupos.set(k, { ano, mes, itens: [] });
    grupos.get(k).itens.push(s);
  }
  return [...grupos.values()]
    .sort((a, b) => idxMes(a.ano, a.mes) - idxMes(b.ano, b.mes))
    .map(({ ano, mes, itens }) => {
      itens.sort((a, b) => iso(a.semana_inicio).localeCompare(iso(b.semana_inicio)));
      const exato = D.sum(itens.map((i) => i.preco_medio)) / BigInt(itens.length);
      const inicios = itens.map((i) => iso(i.semana_inicio));
      return {
        ano, mes,
        preco_medio: D.fmt(exato, 6),
        exato,
        n_semanas: itens.length,
        n_postos_total: itens.reduce((acc, i) => acc + Number(i.n_postos || 0), 0),
        semanas: itens.map((i) => ({ inicio: iso(i.semana_inicio), fim: iso(i.semana_fim), preco: D.round(i.preco_medio, 4) })),
        ultima_semana_fim: iso(itens.at(-1).semana_fim),
        mes_completo: mesCompleto(ano, mes, inicios, hoje),
      };
    });
}

/** Regra 4: média simples das médias mensais NE e NO (só nos meses em que AMBAS existem). */
export function mediaCombinada(mesesNE, mesesN) {
  const porMesN = new Map(mesesN.map((m) => [chaveMes(m.ano, m.mes), m]));
  const out = [];
  for (const ne of mesesNE) {
    const n = porMesN.get(chaveMes(ne.ano, ne.mes));
    if (!n) continue;
    const a = ne.exato ?? D.parse(ne.preco_medio);
    const b = n.exato ?? D.parse(n.preco_medio);
    const exato = (a + b) / 2n;
    out.push({
      ano: ne.ano, mes: ne.mes, preco_medio: D.fmt(exato, 6), exato,
      n_semanas: Math.min(ne.n_semanas, n.n_semanas),
      n_postos_total: (ne.n_postos_total || 0) + (n.n_postos_total || 0),
      ultima_semana_fim: [ne.ultima_semana_fim, n.ultima_semana_fim].sort()[0],
      mes_completo: Boolean(ne.mes_completo && n.mes_completo),
      preco_ne: ne.preco_medio, preco_no: n.preco_medio,
    });
  }
  return out.sort((a, b) => idxMes(a.ano, a.mes) - idxMes(b.ano, b.mes));
}

/** Ordena marcos: referência mais recente primeiro; no mesmo mês, o de maior id. */
const marcoMaisRecente = (a, b) => (idxMes(a.ref_ano, a.ref_mes) - idxMes(b.ref_ano, b.ref_mes)) || (a.id - b.id);

/** Regra 8: marco aplicável ao mês = o de referência mais recente ≤ mês. marcos: [{ id, ref_ano, ref_mes, preco_referencia }] */
export function marcoDoMes(marcos, ano, mes) {
  const alvo = idxMes(ano, mes);
  let escolhido = null;
  for (const m of marcos) {
    if (m.preco_referencia == null || idxMes(m.ref_ano, m.ref_mes) > alvo) continue;
    if (!escolhido || marcoMaisRecente(m, escolhido) > 0) escolhido = m;
  }
  return escolhido;
}

/**
 * Regra 10: marco zero automático. Percorre os meses em ordem; o mês cuja variação contra o marco em
 * vigor atinge ≥ +L% ou ≤ −L% vira o novo marco zero (com o próprio preço) e o acumulado recomeça nele.
 * ancoras = marcos que não são automáticos (inicial de jan/2026 e redefinições manuais): reiniciam a
 * cadeia no seu mês. Função pura — recalculada do zero a cada atualização, então correções da ANP
 * criam, movem ou removem marcos automáticos.
 * Retorna [{ ref_ano, ref_mes, preco_referencia, mes_parcial, direcao, variacao_pct, anterior: { ref_ano, ref_mes, preco_referencia } }].
 */
export function cadeiaMarcosAutomaticos(meses, ancoras, limitePct = 5) {
  const ordenados = [...meses].sort((a, b) => idxMes(a.ano, a.mes) - idxMes(b.ano, b.mes));
  const validas = ancoras.filter((a) => a.preco_referencia != null).sort(marcoMaisRecente);
  const out = [];
  let ref = null;
  for (const m of ordenados) {
    const alvo = idxMes(m.ano, m.mes);
    // âncora mais recente que já começou e é posterior ao marco em vigor reinicia a cadeia
    const ancora = validas.filter((a) => idxMes(a.ref_ano, a.ref_mes) <= alvo).at(-1);
    if (ancora && (!ref || idxMes(ancora.ref_ano, ancora.ref_mes) > idxMes(ref.ref_ano, ref.ref_mes))) ref = ancora;
    if (!ref || alvo <= idxMes(ref.ref_ano, ref.ref_mes)) continue;
    const direcao = D.classificarGatilho(m.preco_medio, ref.preco_referencia, limitePct);
    if (direcao === "SEM_GATILHO") continue;
    const novo = {
      ref_ano: m.ano, ref_mes: m.mes, preco_referencia: m.preco_medio, mes_parcial: !m.mes_completo, direcao,
      variacao_pct: D.variacaoPct(m.preco_medio, ref.preco_referencia),
      anterior: { ref_ano: ref.ref_ano, ref_mes: ref.ref_mes, preco_referencia: ref.preco_referencia },
    };
    out.push(novo);
    ref = novo;
  }
  return out;
}

/** Regras 6, 7 e 9: série mensal com diferenças, variações, marco aplicável e gatilho. */
export function serieIndicador(meses, marcos = [], limitePct = 5) {
  const ordenados = [...meses].sort((a, b) => idxMes(a.ano, a.mes) - idxMes(b.ano, b.mes));
  let prev = null;
  return ordenados.map((m) => {
    const row = { ...m };
    delete row.exato;
    const consecutivo = prev && idxMes(prev.ano, prev.mes) + 1 === idxMes(m.ano, m.mes);
    row.diferenca_mensal = consecutivo ? D.fmt(D.sub(m.preco_medio, prev.preco_medio), 6) : null;
    row.variacao_mensal_pct = consecutivo ? D.variacaoPct(m.preco_medio, prev.preco_medio) : null;
    const marco = marcoDoMes(marcos, m.ano, m.mes);
    if (marco) {
      row.marco_id = marco.id;
      row.marco_ref = { ano: marco.ref_ano, mes: marco.ref_mes, preco: marco.preco_referencia };
      row.variacao_acumulada_pct = D.variacaoPct(m.preco_medio, marco.preco_referencia);
      row.diferenca_acumulada = D.fmt(D.sub(m.preco_medio, marco.preco_referencia), 6);
      row.gatilho = D.classificarGatilho(m.preco_medio, marco.preco_referencia, limitePct);
      row.marco_inicia_aqui = marco.ref_ano === m.ano && marco.ref_mes === m.mes;
    } else {
      Object.assign(row, { marco_id: null, marco_ref: null, variacao_acumulada_pct: null, diferenca_acumulada: null, gatilho: null, marco_inicia_aqui: false });
    }
    prev = m;
    return row;
  });
}

/**
 * Marcos de uma região derivados dos marcos do indicador NE/NO: mesmo mês de referência, mas com o
 * preço da PRÓPRIA região naquele mês (para comparação individual de Norte e Nordeste).
 */
export function marcosParaRegiao(marcos, mesesRegiao) {
  const porMes = new Map(mesesRegiao.map((m) => [chaveMes(m.ano, m.mes), m.preco_medio]));
  return marcos.map((m) => ({ ...m, preco_referencia: porMes.get(chaveMes(m.ref_ano, m.ref_mes)) ?? null }));
}

/** Primeiro mês (após o marco) que atinge cada gatilho, considerando apenas meses regidos por esse marco. */
export function detectarGatilhos(serie, marco) {
  const res = { ALTA: null, BAIXA: null };
  for (const row of serie) {
    if (row.marco_id !== marco.id) continue;
    if (idxMes(row.ano, row.mes) <= idxMes(marco.ref_ano, marco.ref_mes)) continue;
    if ((row.gatilho === "ALTA" || row.gatilho === "BAIXA") && !res[row.gatilho]) res[row.gatilho] = row;
  }
  return res;
}

/** Quanto falta (p.p. e preço) para os gatilhos a partir do marco. */
export function distanciaGatilhos(precoAtual, precoReferencia, limitePct = 5) {
  const variacao = D.variacaoPct(precoAtual, precoReferencia);
  const L = D.parse(limitePct);
  const v = D.parse(variacao);
  return {
    variacao_pct: variacao,
    diferenca_rs: D.fmt(D.sub(precoAtual, precoReferencia), 6),
    restante_alta_pp: D.fmt(L - v, 4),   // ≤ 0 ⇒ gatilho de aumento atingido
    restante_baixa_pp: D.fmt(v + L, 4),  // ≤ 0 ⇒ gatilho de redução atingido
    preco_gatilho_alta: D.fmt(D.aplicarPct(precoReferencia, limitePct), 6),
    preco_gatilho_baixa: D.fmt(D.aplicarPct(precoReferencia, -Number(limitePct)), 6),
    gatilho: D.classificarGatilho(precoAtual, precoReferencia, limitePct),
  };
}

/**
 * Tabela no formato da planilha: JAN..DEZ + ACUM.
 * series: { BA, NE, N, NENO: serieIndicador(...) }; base: série usada nas linhas de variação/diferença (padrão NENO).
 * ACUM — preços: média dos meses disponíveis do ano.
 *        variação/diferença mensal: do mês anterior ao primeiro mês do ano (ou do 1º mês, se não houver) até o último mês.
 *        variação/diferença acumulada: valor do último mês disponível (contra o marco vigente nele).
 */
export function tabelaPlanilha(series, ano, base = "NENO") {
  const doAno = (serie) => { const map = new Map((serie || []).filter((m) => m.ano === ano).map((m) => [m.mes, m])); return Array.from({ length: 12 }, (_, i) => map.get(i + 1) || null); };
  const linhaPreco = (serie) => {
    const vals = doAno(serie);
    const presentes = vals.filter(Boolean);
    return {
      valores: vals.map((m) => (m ? { valor: m.preco_medio, parcial: !m.mes_completo } : null)),
      acum: presentes.length ? D.fmt(D.sum(presentes.map((m) => m.preco_medio)) / BigInt(presentes.length), 6) : null,
    };
  };
  const serieBase = series[base] || [];
  const vals = doAno(serieBase);
  const presentes = vals.filter(Boolean);
  let acumMensalPct = null, acumMensalRs = null;
  if (presentes.length) {
    const primeiro = presentes[0], ultimo = presentes.at(-1);
    const anterior = serieBase.find((m) => idxMes(m.ano, m.mes) === idxMes(primeiro.ano, primeiro.mes) - 1);
    const ref = anterior || primeiro;
    if (ref !== ultimo) {
      acumMensalPct = D.variacaoPct(ultimo.preco_medio, ref.preco_medio);
      acumMensalRs = D.fmt(D.sub(ultimo.preco_medio, ref.preco_medio), 6);
    }
  }
  const ultimo = presentes.at(-1) || null;
  return {
    ano, meses: NOMES_MES, base,
    linhas: {
      preco_ba: linhaPreco(series.BA),
      preco_ne: linhaPreco(series.NE),
      preco_no: linhaPreco(series.N),
      preco_neno: linhaPreco(series.NENO),
      variacao_mensal_pct: { valores: vals.map((m) => m?.variacao_mensal_pct ?? null), acum: acumMensalPct },
      diferenca_mensal: { valores: vals.map((m) => m?.diferenca_mensal ?? null), acum: acumMensalRs },
      variacao_acumulada_pct: { valores: vals.map((m) => m?.variacao_acumulada_pct ?? null), acum: ultimo?.variacao_acumulada_pct ?? null },
      diferenca_acumulada: { valores: vals.map((m) => m?.diferenca_acumulada ?? null), acum: ultimo?.diferenca_acumulada ?? null },
    },
    marcos_no_ano: vals.map((m) => Boolean(m?.marco_inicia_aqui)),
    gatilhos: vals.map((m) => m?.gatilho ?? null),
  };
}
