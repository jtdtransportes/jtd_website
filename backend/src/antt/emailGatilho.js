// Modelo do e-mail de gatilho (HTML responsivo + texto simples). Sem imagens externas: o "ícone" de alerta é
// feito em HTML para aparecer mesmo com imagens bloqueadas. O assunto é genérico (não cita a localidade);
// os indicadores responsáveis ficam registrados internamente (antt_eventos_gatilho / antt_notificacoes).

export const ASSUNTO = "JTD Transportes | Novo gatilho de reajuste — Diesel S10";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "Aumento", "Redução" ou "Múltiplos gatilhos" (mais de um evento na mesma notificação). */
export function tipoDoAlerta(eventos) {
  if (eventos.length > 1) return "Múltiplos gatilhos";
  return eventos[0]?.direcao === "BAIXA" ? "Redução" : "Aumento";
}

/** Mês mais recente entre os eventos, por extenso (ex.: "novembro de 2026"). */
export function dataDeReferencia(eventos) {
  const ult = [...eventos].sort((a, b) => (b.ref_ano * 12 + b.ref_mes) - (a.ref_ano * 12 + a.ref_mes))[0];
  if (!ult) return "—";
  const mes = MESES[ult.ref_mes - 1];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${ult.ref_ano}${ult.mes_parcial ? " (mês em andamento)" : ""}`;
}

/**
 * Monta assunto, HTML e texto. url = endereço público do módulo (null → sem botão; nunca localhost).
 * teste = true acrescenta "[TESTE]" ao assunto e uma faixa "dados simulados".
 */
export function montarEmailGatilho({ eventos, url, teste = false, limite = 5 }) {
  const assunto = `${teste ? "[TESTE] " : ""}${ASSUNTO}`;
  const tipo = tipoDoAlerta(eventos);
  const data = dataDeReferencia(eventos);
  const linhas = [["Tipo", tipo], ["Limite monitorado", `±${limite}%`], ["Data de referência", data], ["Situação", "Aguardando análise"]];

  const texto = [
    teste ? "*** E-MAIL DE TESTE — dados simulados, nenhum gatilho real foi registrado ***\n" : "",
    "ALERTA AUTOMÁTICO — DIESEL S10",
    "",
    "Olá!",
    "",
    `O sistema de monitoramento da JTD Transportes identificou um novo gatilho de variação de ${limite}% no preço médio do Diesel S10, conforme os dados da ANP.`,
    "",
    "Informações do alerta:",
    ...linhas.map(([k, v]) => `- ${k}: ${v}`),
    "",
    "Recomendamos acessar o módulo ANTT para verificar os detalhes, avaliar a necessidade de reajuste dos fretes e consultar possíveis diferenças de períodos anteriores.",
    "",
    url ? `Acessar módulo ANTT: ${url}` : "Acesse o módulo ANTT no sistema da JTD Transportes.",
    "",
    "Mensagem enviada automaticamente pelo sistema JTD Transportes. A identificação do gatilho não representa aplicação automática de reajuste.",
  ].join("\n").replace(/^\n/, "");

  const fonte = "font-family:Arial,Helvetica,sans-serif;";
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(assunto)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Novo gatilho de ${limite}% no Diesel S10 — ${esc(data)}. Aguardando análise.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f5f7;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e8ec;border-radius:12px;">
      <tr><td style="background:#01304a;border-radius:12px 12px 0 0;padding:18px 28px;${fonte}font-size:16px;font-weight:700;color:#ffffff;letter-spacing:.3px;">JTD Transportes</td></tr>
      ${teste ? `<tr><td style="background:#fff4d6;padding:10px 28px;${fonte}font-size:12px;font-weight:700;color:#8a5a00;">E-MAIL DE TESTE — dados simulados. Nenhum gatilho real foi registrado.</td></tr>` : ""}
      <tr><td style="padding:28px 28px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:#fdf1dc;${fonte}font-size:20px;font-weight:700;color:#b45309;line-height:36px;">!</td>
          <td style="padding-left:12px;${fonte}font-size:12px;font-weight:700;letter-spacing:1.2px;color:#b45309;">ALERTA AUTOMÁTICO — DIESEL S10</td>
        </tr></table>
        <h1 style="margin:18px 0 10px;${fonte}font-size:22px;line-height:1.3;font-weight:700;color:#01304a;">Novo gatilho de reajuste</h1>
        <p style="margin:0 0 12px;${fonte}font-size:15px;line-height:1.55;color:#1f2a33;">Olá!</p>
        <p style="margin:0 0 18px;${fonte}font-size:15px;line-height:1.55;color:#1f2a33;">O sistema de monitoramento da JTD Transportes identificou um novo gatilho de variação de ${limite}% no preço médio do Diesel S10, conforme os dados da ANP.</p>
      </td></tr>
      <tr><td style="padding:0 28px 8px;">
        <p style="margin:0 0 8px;${fonte}font-size:12px;font-weight:700;letter-spacing:.8px;color:#6b7c88;text-transform:uppercase;">Informações do alerta</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eef1f4;">
          ${linhas.map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eef1f4;${fonte}font-size:14px;color:#6b7c88;">${esc(k)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef1f4;${fonte}font-size:14px;font-weight:700;color:#01304a;">${esc(v)}</td></tr>`).join("")}
        </table>
      </td></tr>
      <tr><td style="padding:14px 28px 6px;">
        <p style="margin:0;${fonte}font-size:15px;line-height:1.55;color:#1f2a33;">Recomendamos acessar o módulo ANTT para verificar os detalhes, avaliar a necessidade de reajuste dos fretes e consultar possíveis diferenças de períodos anteriores.</p>
      </td></tr>
      <tr><td style="padding:18px 28px 28px;">
        ${url
          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:8px;background:#01304a;"><a href="${esc(url)}" target="_blank" style="display:inline-block;padding:12px 24px;${fonte}font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">Acessar módulo ANTT</a></td></tr></table>`
          : `<p style="margin:0;${fonte}font-size:14px;color:#01304a;font-weight:700;">Acesse o módulo ANTT no sistema da JTD Transportes.</p>`}
      </td></tr>
      <tr><td style="padding:16px 28px 22px;border-top:1px solid #eef1f4;${fonte}font-size:12px;line-height:1.5;color:#8a99a4;">Mensagem enviada automaticamente pelo sistema JTD Transportes. A identificação do gatilho não representa aplicação automática de reajuste.</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { assunto, html, texto, tipo, data };
}
