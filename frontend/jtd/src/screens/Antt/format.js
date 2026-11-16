// Formatação apenas para EXIBIÇÃO (os cálculos financeiros são feitos no backend com decimais exatos).
export const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
export const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

export function fmtNumber(v, digits = 2) {
  const n = num(v);
  if (n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const fmtBRL = (v, digits = 2) => (num(v) === null ? "—" : `R$ ${fmtNumber(v, digits)}`);

export function fmtPct(v, digits = 2, sinal = true) {
  const n = num(v);
  if (n === null || Number.isNaN(n)) return "—";
  return `${sinal && n > 0 ? "+" : ""}${fmtNumber(n, digits)}%`;
}

/** Diferença em R$/L com sinal (ex.: +R$ 0,1500). */
export function fmtDifRs(v, digits = 4) {
  const n = num(v);
  if (n === null || Number.isNaN(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}R$ ${fmtNumber(Math.abs(n), digits)}`;
}

/** Diferença em R$ por litro para exibição principal (2 casas): +R$ 0,26/L · -R$ 0,05/L. */
export const fmtRsL = (v, digits = 2) => (num(v) === null ? "—" : `${fmtDifRs(v, digits)}/L`);

/** Valor completo para consulta (tooltip): mantém a precisão vinda do backend. */
export const completo = (v, sufixo = "") => (num(v) === null ? undefined : `${String(v).replace(".", ",")}${sufixo}`);

/** Indicadores na ordem da planilha: Bahia, Nordeste, Norte e a média combinada NE/NO (referência do gatilho). */
export const LOCALIDADES = ["BA", "NE", "N", "NENO"];
export const ROTULO_INDICADOR = { NENO: "Média NE/NO", BA: "Bahia", NE: "Nordeste", N: "Norte" };
export const SIGLA_INDICADOR = { NENO: "NE/NO", BA: "BA", NE: "NE", N: "NO" };
export const COR_INDICADOR = { NENO: "#01304a", BA: "#c98a2b", NE: "#0b72c9", N: "#7fb6e4" };

export function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  const [data, hora] = String(iso).split("T");
  return `${fmtDate(data)} ${hora ? hora.slice(0, 5) : ""}`.trim();
}

export const rotuloMes = (ano, mes) => `${MESES[mes - 1]}/${String(ano).slice(2)}`;
export const rotuloMesLongo = (ano, mes) => `${MESES_LONGOS[mes - 1]} de ${ano}`;

export const ROTULO_FONTE = {
  ANP_RESUMO_SEMANAL: "ANP — Resumo semanal oficial",
  ANP_MICRODADOS: "ANP — Microdados por posto (média calculada)",
};
export const ROTULO_METODOLOGIA = {
  MEDIA_SIMPLES_SEMANAS: "Média simples das semanas",
  MEDIA_PONDERADA_POSTOS: "Média ponderada por nº de postos",
};

export function rotuloLocal(escopo, chave, opcoes) {
  if (escopo === "BRASIL") return "Brasil";
  if (escopo === "REGIAO") return opcoes?.regioes?.find((r) => r.sigla === chave)?.nome || chave;
  return opcoes?.estados?.find((e) => e.sigla === chave)?.nome || chave;
}

/** Classe semântica: alta de preço (aumento) e baixa (redução). */
export const classeGatilho = (g) => (g === "ALTA" ? "is-alta" : g === "BAIXA" ? "is-baixa" : "is-neutro");
export const textoGatilho = (g, limite = 5) =>
  g === "ALTA" ? `Gatilho de aumento (≥ +${limite}%)` : g === "BAIXA" ? `Gatilho de redução (≤ -${limite}%)` : "Sem gatilho";
