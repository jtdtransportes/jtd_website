// Aritmética decimal exata (BigInt em escala fixa) para cálculos financeiros.
// Entradas aceitas: string decimal ("7.3100", "7,31"), inteiro ou number finito.
// Nunca usar Number para somar/multiplicar valores monetários neste módulo.
// Valores "escalados" (bigint) têm 12 casas implícitas; use fmt()/round() para exibir.

export const SCALE = 12;
export const ONE = 10n ** BigInt(SCALE);
const HUNDRED = 100n * ONE;

function numberToString(n) {
  if (!Number.isFinite(n)) throw new Error("Número não finito.");
  const s = String(n);
  return /e/i.test(s) ? n.toFixed(SCALE) : s;
}

/** Converte entrada externa (string/number) para bigint escalado. bigint passa direto (já escalado). */
export function parse(value) {
  if (typeof value === "bigint") return value;
  if (value === null || value === undefined || value === "") throw new Error("Valor decimal ausente.");
  let s = typeof value === "number" ? numberToString(value) : String(value).trim();
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  const m = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`Valor decimal inválido: "${value}"`);
  const frac = (m[3] || "").padEnd(SCALE + 1, "0").slice(0, SCALE + 1);
  let n = BigInt(m[2]) * ONE + BigInt(frac.slice(0, SCALE));
  if (frac[SCALE] >= "5") n += 1n; // half-up nos dígitos além da escala
  return m[1] === "-" ? -n : n;
}

function divRound(num, den) {
  if (den === 0n) throw new Error("Divisão por zero.");
  const neg = num < 0n !== den < 0n;
  const n = num < 0n ? -num : num;
  const d = den < 0n ? -den : den;
  const q = (n * 2n + d) / (d * 2n); // half-up (afastando de zero)
  return neg ? -q : q;
}

export const add = (a, b) => parse(a) + parse(b);
export const sub = (a, b) => parse(a) - parse(b);
export const mul = (a, b) => divRound(parse(a) * parse(b), ONE);
export const div = (a, b) => divRound(parse(a) * ONE, parse(b));
export const cmp = (a, b) => { const x = parse(a), y = parse(b); return x < y ? -1 : x > y ? 1 : 0; };
export const sum = (list) => list.reduce((acc, v) => acc + parse(v), 0n);

/** bigint escalado → string com `places` casas (half-up). */
export function fmt(scaled, places = 2) {
  const neg = scaled < 0n;
  let n = neg ? -scaled : scaled;
  const drop = BigInt(SCALE - places);
  if (drop > 0n) { const f = 10n ** drop; n = (n * 2n + f) / (f * 2n); }
  const s = n.toString().padStart(places + 1, "0");
  const out = places > 0 ? `${s.slice(0, -places)}.${s.slice(-places)}` : s;
  return neg && /[1-9]/.test(out) ? `-${out}` : out;
}

/** Arredonda entrada externa e devolve string. */
export const round = (value, places = 2) => fmt(parse(value), places);

/** Variação (%) = ((atual / referência) - 1) × 100, 4 casas por padrão. */
export function variacaoPct(atual, referencia, places = 4) {
  const ref = parse(referencia);
  if (ref <= 0n) throw new Error("Preço de referência deve ser maior que zero.");
  return fmt(divRound((parse(atual) - ref) * 100n * ONE, ref), places);
}

/**
 * Classifica o gatilho gerencial com comparação EXATA (sem arredondar):
 *   ALTA  se atual ≥ ref × (1 + L/100)   (variação ≥ +L%, inclusive)
 *   BAIXA se atual ≤ ref × (1 − L/100)   (variação ≤ −L%, inclusive)
 *   SEM_GATILHO entre os dois limites.
 * Compara atual×100 com ref×(100±L) em inteiros de mesma escala — nenhuma divisão envolvida.
 */
export function classificarGatilho(atual, referencia, limitePct = 5) {
  const a = parse(atual) * HUNDRED;
  const r = parse(referencia);
  if (r <= 0n) throw new Error("Preço de referência deve ser maior que zero.");
  const L = parse(limitePct);
  if (a >= r * (HUNDRED + L)) return "ALTA";
  if (a <= r * (HUNDRED - L)) return "BAIXA";
  return "SEM_GATILHO";
}

/** ref × (1 + pct/100), escalado. */
export const aplicarPct = (ref, pct) => divRound(parse(ref) * (HUNDRED + parse(pct)), HUNDRED);
