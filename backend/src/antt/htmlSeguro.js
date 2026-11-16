// Sanitização do conteúdo editado pelo funcionário (editor simples: parágrafos, negrito, listas e quebras de linha).
// Lista branca estrita: só p, br, strong, em, ul, ol e li, SEM nenhum atributo (nada de style, href, on*, src...).
// Tags fora da lista são removidas mantendo o texto; script/style/iframe etc. são removidos com o conteúdo.
// A saída é sempre balanceada (toda tag aberta é fechada), para não "vazar" formatação no modelo do e-mail.

const REMOVER_COM_CONTEUDO = ["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "head", "title", "textarea", "select", "button", "form", "video", "audio", "canvas", "xml"];
const MAPA = { p: "p", div: "p", h1: "p", h2: "p", h3: "p", h4: "p", h5: "p", h6: "p", blockquote: "p", br: "br", strong: "strong", b: "strong", em: "em", i: "em", ul: "ul", ol: "ol", li: "li" };
const BLOCOS = new Set(["p", "ul", "ol", "li"]);
const INLINE = new Set(["strong", "em"]);
export const LIMITE_CORPO = 100_000;

/** Escapa texto: preserva entidades válidas (&nbsp; &amp; &#233;) e escapa o resto. */
function escaparTexto(s) {
  return s
    .replace(/&(?!(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});)/gi, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function sanitizarCorpo(entrada) {
  let s = String(entrada ?? "").slice(0, LIMITE_CORPO);
  s = s.replace(/<!--[\s\S]*?(?:-->|$)/g, "").replace(/<!\[CDATA\[[\s\S]*?(?:\]\]>|$)/gi, "").replace(/<![^>]*>/g, "").replace(/<\?[\s\S]*?(?:\?>|$)/g, "");
  for (const t of REMOVER_COM_CONTEUDO) {
    s = s.replace(new RegExp(`<${t}\\b[\\s\\S]*?(?:<\\/${t}\\s*>|$)`, "gi"), "");
  }
  s = s.replace(/<\/?(?:script|style|iframe)\b[^>]*>?/gi, "");      // sobras soltas

  const out = [];
  const pilha = [];
  const topo = () => pilha[pilha.length - 1];
  const dentro = (t) => pilha.includes(t);
  const abrir = (t) => { out.push(`<${t}>`); pilha.push(t); };
  const fecharAte = (t) => { while (pilha.length) { const x = pilha.pop(); out.push(`</${x}>`); if (x === t) break; } };
  // Conteúdo inline (texto, negrito, <br>) solto no nível de bloco ganha um <p> automático.
  const garantirBloco = () => {
    if (!pilha.length || topo() === "ul" || topo() === "ol") {
      if (topo() === "ul" || topo() === "ol") abrir("li"); else abrir("p");
    }
  };

  const tokens = s.match(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>|<|[^<]+/g) || [];
  for (const tok of tokens) {
    const m = /^<(\/)?([a-zA-Z][a-zA-Z0-9]*)/.exec(tok);
    if (!m || tok === "<") {                                         // texto
      const texto = tok === "<" ? "&lt;" : escaparTexto(tok);
      if (!texto.trim() && (!pilha.length || topo() === "ul" || topo() === "ol")) continue;   // espaço entre blocos
      garantirBloco();
      out.push(texto);
      continue;
    }
    const fechando = Boolean(m[1]);
    const tag = MAPA[m[2].toLowerCase()];
    if (!tag) continue;                                              // tag desconhecida: some, o texto fica

    if (tag === "br") { if (!fechando) { garantirBloco(); out.push("<br>"); } continue; }

    if (fechando) {
      if (tag === "p" && dentro("li")) continue;                     // <li><p>..</p></li> → texto do item
      if (dentro(tag)) fecharAte(tag);
      continue;
    }
    if (INLINE.has(tag)) { garantirBloco(); if (!dentro(tag)) abrir(tag); continue; }
    if (tag === "p") {
      if (dentro("li")) continue;
      while (pilha.length) fecharAte(topo());                        // parágrafo não aninha
      abrir("p");
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      while (pilha.length && topo() !== "li") fecharAte(topo());     // lista aninhada só dentro de item
      abrir(tag);
      continue;
    }
    if (tag === "li") {
      while (pilha.length && topo() !== "ul" && topo() !== "ol") fecharAte(topo());
      if (!pilha.length) abrir("ul");
      abrir("li");
    }
  }
  while (pilha.length) fecharAte(topo());

  // Remove blocos vazios (só espaços, &nbsp; e <br>), repetindo para pegar listas que ficaram vazias.
  let html = out.join("");
  const vazio = /<(p|li|strong|em)>(?:\s|&nbsp;|&#160;|<br>)*<\/\1>|<(ul|ol)>\s*<\/\2>/g;
  for (let antes = null, i = 0; antes !== html && i < 6; i++) { antes = html; html = html.replace(vazio, ""); }
  return html
    .replace(/\s+/g, " ")                                            // espaços/quebras do código-fonte não contam no HTML
    .replace(/(<(?:p|li)>)\s+/g, "$1").replace(/\s+(<\/(?:p|li)>)/g, "$1")
    .replace(/(?:<br>)+(<\/(?:p|li)>)/g, "$1")
    .replace(/>\s+</g, (m, i, s) => (/<\/(?:p|ul|ol|li)>$/.test(s.slice(0, i + 1)) ? "><" : m))
    .trim();
}

const ENTIDADES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
function decodificar(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (x, e) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return x; }
    }
    return ENTIDADES[e.toLowerCase()] ?? x;
  });
}

/** Versão em texto simples do conteúdo SANITIZADO (parte text/plain do e-mail). */
export function htmlParaTexto(html) {
  const linhas = [];
  let atual = "";
  const contadores = [];
  const quebra = () => { if (atual.trim()) linhas.push(atual.trim()); atual = ""; };
  for (const tok of String(html).match(/<\/?[a-z]+>|[^<]+/g) || []) {
    switch (tok) {
      case "<p>": quebra(); break;
      case "</p>": quebra(); linhas.push(""); break;
      case "<br>": linhas.push(atual.trim()); atual = ""; break;
      case "<ul>": quebra(); contadores.push(null); break;
      case "<ol>": quebra(); contadores.push(0); break;
      case "</ul>": case "</ol>": quebra(); contadores.pop(); if (!contadores.length) linhas.push(""); break;
      case "<li>": {
        quebra();
        const nivel = contadores.length - 1;
        const c = contadores[nivel];
        if (c === null || c === undefined) atual = `${"  ".repeat(Math.max(0, nivel))}- `;
        else { contadores[nivel] = c + 1; atual = `${"  ".repeat(nivel)}${c + 1}. `; }
        break;
      }
      case "</li>": quebra(); break;
      default: if (!tok.startsWith("<")) atual += decodificar(tok).replace(/\s+/g, " ");
    }
  }
  quebra();
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
