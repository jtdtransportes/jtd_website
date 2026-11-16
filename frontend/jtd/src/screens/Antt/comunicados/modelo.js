// Modelo padrão da mensagem de reajuste. Os dados opcionais (percentual, vigência, contrato) entram no texto quando
// informados; quando não, a frase é adaptada — nunca sobra variável vazia nem valor inventado.
// O percentual é SEMPRE o informado pelo responsável (não é calculado a partir do gatilho da ANP).

export const ASSUNTO_PADRAO = "JTD Transportes | Solicitação de reajuste contratual";

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "8,5" | "8.5" | "8,50%" → "8.5" (string normalizada) · "" → null · inválido → undefined. */
export function normalizarPercentual(v) {
  const s = String(v ?? "").trim().replace("%", "").replace(",", ".").trim();
  if (!s) return null;
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(s) || Number(s) <= 0 || Number(s) > 100) return undefined;
  return String(Number(s));
}

/** "8.5" → "8,5%" · "10" → "10%" · "7.25" → "7,25%". */
export function fmtPercentual(v) {
  const n = normalizarPercentual(v);
  if (!n) return null;
  return `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;
}

/** "2026-12-01" → "01/12/2026". */
export function fmtDataBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

export const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** { ano: 2026, mes: 11 } → "novembro de 2026". */
export const mesPorExtenso = (a) => (a?.ano && a?.mes >= 1 && a?.mes <= 12 ? `${MESES_LONGOS[a.mes - 1]} de ${a.ano}` : "");

/**
 * referencia: mês do acumulado do Diesel S10 (ex.: "novembro de 2026"). O percentual vem pré-preenchido com o
 * acumulado do mês (editável) e o texto COMUNICA o reajuste (não é uma proposta).
 */
export function montarModelo({ cliente = "", contato = "", percentual = "", vigencia = "", contrato = "", referencia = "" } = {}) {
  const nome = String(cliente || "").trim();
  const pessoa = String(contato || "").trim();
  const ref = String(contrato || "").trim();
  const mes = String(referencia || "").trim();
  const pct = fmtPercentual(percentual);
  const data = fmtDataBr(vigencia);
  const b = (s) => `<strong>${esc(s)}</strong>`;
  const aPartir = data ? `, a partir de ${b(data)}` : "";

  const reajuste = pct
    ? `Com base nos levantamentos de preços divulgados pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis (ANP), o reajuste acumulado do óleo diesel S10 atingiu ${b(pct)}${mes ? ` em ${esc(mes)}` : ""}. Dessa forma, esse percentual será aplicado aos valores atualmente praticados${aPartir}.`
    : `Com base nos levantamentos de preços divulgados pela Agência Nacional do Petróleo, Gás Natural e Biocombustíveis (ANP), os valores atualmente praticados serão reajustados conforme o acumulado do óleo diesel S10${mes ? ` apurado em ${esc(mes)}` : ""}${aPartir}.`;

  const paragrafos = [
    nome ? `${b(nome)}${pessoa ? `<br>A/C: ${esc(pessoa)}` : ""}` : null,
    pessoa ? `Prezado(a) ${esc(pessoa)},` : "Prezados(as),",
    "Esperamos que esta mensagem os encontre bem.",
    `A JTD Transportes vem, por meio desta, comunicar o reajuste dos valores de frete praticados ${ref ? `no âmbito do contrato ${b(ref)}` : "em nossa prestação de serviços de transporte"}, em razão da variação dos custos operacionais, em especial do preço do óleo diesel S10.`,
    reajuste,
    "A medida tem como objetivo preservar o equilíbrio econômico-financeiro da prestação dos serviços, mantendo o padrão de qualidade, segurança e pontualidade que orienta a nossa parceria.",
    "Permanecemos à disposição para esclarecer quaisquer dúvidas e, se necessário, agendar uma conversa sobre o tema.",
    "Atenciosamente,",
  ];
  return paragrafos.filter(Boolean).map((p) => `<p>${p}</p>`).join("");
}

/** Remove tags para checagens simples (mensagem vazia). */
export const textoDe = (html) => String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Chave única por tentativa de envio (evita duplicidade por clique repetido). */
export function novaChave() {
  const c = typeof window !== "undefined" ? window.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) return Array.from(c.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join("");
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 48);
}
