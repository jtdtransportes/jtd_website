// Piso mínimo de frete ANTT e cobranças retroativas (funções puras, decimais exatos).
// Fórmula (Tabelas A e B, carga geral): Piso = (distância_km × CCD) + CC
//   CCD = coeficiente de custo de deslocamento (R$/km)
//   CC  = coeficiente de custo de carga e descarga (R$, valor fixo)
// Os coeficientes NUNCA são calculados/estimados aqui: vêm de tabela oficial cadastrada
// (com vigência e fonte) ou de digitação manual identificada como "não oficial".
import * as D from "./decimal.js";

export const MODOS_AJUSTE_CC = {
  SOMAR_AO_CC: "Somar o valor ao CC (R$ fixo por frete)",
  SOMAR_AO_CCD: "Somar o valor ao CCD (R$ por km)",
  PERCENTUAL_SOBRE_CC: "Aumentar o CC em valor percentual (ex.: 0,085 = 0,085%)",
};

/** Aplica o ajuste adicional (0,085 configurável) sobre os coeficientes. */
export function aplicarAjusteCoeficientes({ ccd, cc }, ajuste) {
  const valor = D.parse(ajuste.valor);
  switch (ajuste.modo) {
    case "SOMAR_AO_CC": return { ccd: D.parse(ccd), cc: D.parse(cc) + valor };
    case "SOMAR_AO_CCD": return { ccd: D.parse(ccd) + valor, cc: D.parse(cc) };
    case "PERCENTUAL_SOBRE_CC": return { ccd: D.parse(ccd), cc: D.aplicarPct(cc, valor) };
    default: throw new Error("Forma de aplicação do ajuste não definida.");
  }
}

export function pisoMinimo(distanciaKm, { ccd, cc }) {
  const km = D.parse(distanciaKm);
  if (km < 0n) throw new Error("Distância não pode ser negativa.");
  return D.mul(km, ccd) + D.parse(cc);
}

/**
 * Cálculo completo da calculadora.
 * entrada: { distanciaKm, ccd, cc, valorPraticado? }
 * ajuste: { valor, modo, confirmado } vindo da configuração (ou simulação explícita).
 * O resultado "oficial" só inclui o ajuste se estiver confirmado; caso contrário o
 * ajuste aparece apenas como simulação separada, identificada como não oficial.
 */
export function calcularFrete(entrada, ajuste = null) {
  const base = { ccd: D.parse(entrada.ccd), cc: D.parse(entrada.cc) };
  const oficialValor = pisoMinimo(entrada.distanciaKm, base);
  const resp = {
    distancia_km: D.round(entrada.distanciaKm, 2),
    ccd_utilizado: D.fmt(base.ccd, 6),
    cc_utilizado: D.fmt(base.cc, 6),
    parcela_deslocamento: D.fmt(D.mul(entrada.distanciaKm, base.ccd), 2),
    valor_minimo: D.fmt(oficialValor, 2),
    ajuste: null,
  };
  let valorFinal = oficialValor;
  if (ajuste && ajuste.valor !== undefined && ajuste.valor !== null && ajuste.valor !== "") {
    const info = { valor: D.round(ajuste.valor, 6), modo: ajuste.modo || null, confirmado: Boolean(ajuste.confirmado) };
    if (!ajuste.modo) {
      info.situacao = "NAO_APLICADO_FORMA_INDEFINIDA";
      info.aviso = "Unidade e forma de aplicação do ajuste ainda não foram definidas; ele não participou do cálculo.";
    } else {
      const ajustado = aplicarAjusteCoeficientes(base, ajuste);
      const valorAjustado = pisoMinimo(entrada.distanciaKm, ajustado);
      info.ccd_ajustado = D.fmt(ajustado.ccd, 6);
      info.cc_ajustado = D.fmt(ajustado.cc, 6);
      info.valor_com_ajuste = D.fmt(valorAjustado, 2);
      info.diferenca = D.fmt(valorAjustado - oficialValor, 2);
      if (ajuste.confirmado) {
        info.situacao = "APLICADO_CONFIRMADO";
        valorFinal = valorAjustado;
      } else {
        info.situacao = "SIMULACAO_NAO_CONFIRMADA";
        info.aviso = "Simulação: ajuste ainda não confirmado; NÃO faz parte do valor oficial.";
      }
    }
    resp.ajuste = info;
  }
  resp.valor_oficial_calculado = D.fmt(valorFinal, 2);
  if (entrada.valorPraticado !== undefined && entrada.valorPraticado !== null && entrada.valorPraticado !== "") {
    const pr = D.parse(entrada.valorPraticado);
    resp.comparacao = {
      valor_praticado: D.fmt(pr, 2),
      diferenca: D.fmt(valorFinal - pr, 2),
      diferenca_pct: pr > 0n ? D.variacaoPct(valorFinal, pr, 2) : null,
    };
  }
  return resp;
}

/**
 * Retroativos. fretes: [{ id, identificacao, data_frete, km, valor_cobrado, ccd_aplicado?, cc_aplicado? }]
 * coefNovosFn(frete) → { ccd, cc } | null — coeficientes da tabela nova (por nº de eixos do frete); null ⇒ frete ignorado
 * coefOriginaisFn(frete) → { ccd, cc } | null — coeficientes originalmente aplicáveis (para decompor o efeito)
 * Só entram fretes com data_frete >= dataVigencia (e dentro do período informado).
 * valor_recalculado é arredondado a centavos POR VIAGEM e o total é a soma dos valores já arredondados.
 */
export function calcularRetroativo({ fretes, coefNovosFn, dataVigencia, periodoInicio, periodoFim, apenasPositivas = false, coefOriginaisFn = null }) {
  const ini = periodoInicio > dataVigencia ? periodoInicio : dataVigencia;
  const itens = [];
  const ignorados = [];
  for (const f of fretes) {
    const data = String(f.data_frete).slice(0, 10);
    if (data < ini || data > periodoFim) { ignorados.push({ identificacao: f.identificacao, motivo: "fora do período/vigência" }); continue; }
    const coefNovos = coefNovosFn(f);
    if (!coefNovos) { ignorados.push({ identificacao: f.identificacao, motivo: "sem coeficiente para os eixos/tabela do frete" }); continue; }
    const km = D.parse(f.km);
    const novo = D.mul(km, coefNovos.ccd) + D.parse(coefNovos.cc);
    const recalc = D.parse(D.fmt(novo, 2));
    const cobrado = D.parse(D.fmt(D.parse(f.valor_cobrado), 2));
    let diferenca = recalc - cobrado;
    const orig = coefOriginaisFn ? coefOriginaisFn(f) : (f.ccd_aplicado != null && f.cc_aplicado != null ? { ccd: f.ccd_aplicado, cc: f.cc_aplicado } : null);
    const item = {
      frete_id: f.id ?? null,
      identificacao: f.identificacao,
      data_frete: data,
      km: D.fmt(km, 2),
      valor_cobrado: D.fmt(cobrado, 2),
      ccd_original: orig ? D.round(orig.ccd, 6) : null,
      cc_original: orig ? D.round(orig.cc, 6) : null,
      ccd_novo: D.round(coefNovos.ccd, 6),
      cc_novo: D.round(coefNovos.cc, 6),
      valor_recalculado: D.fmt(recalc, 2),
      efeito_ccd: orig ? D.fmt(D.mul(km, D.sub(coefNovos.ccd, orig.ccd)), 2) : null, // variação do coef. por km
      efeito_cc: orig ? D.fmt(D.sub(coefNovos.cc, orig.cc), 2) : null,               // variação do coef. fixo
    };
    if (apenasPositivas && diferenca < 0n) diferenca = 0n;
    item.diferenca = D.fmt(diferenca, 2);
    itens.push(item);
  }
  const qtd = itens.length;
  const kmTotal = D.sum(itens.map((i) => i.km));
  const totalCobrado = D.sum(itens.map((i) => i.valor_cobrado));
  const totalRecalc = D.sum(itens.map((i) => i.valor_recalculado));
  const totalRetro = D.sum(itens.map((i) => i.diferenca));
  return {
    itens,
    ignorados,
    resumo: {
      qtd_fretes: qtd,
      km_total: D.fmt(kmTotal, 2),
      km_medio: qtd ? D.fmt(kmTotal / BigInt(qtd), 2) : "0.00",
      total_cobrado: D.fmt(totalCobrado, 2),
      total_recalculado: D.fmt(totalRecalc, 2),
      total_retroativo: D.fmt(totalRetro, 2),
    },
  };
}
