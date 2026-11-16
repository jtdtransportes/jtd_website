// Modelo do e-mail "Comunicar reajuste" (envio MANUAL a clientes). Mesma identidade dos alertas do módulo
// (emailGatilho.js): tabelas + estilos inline, sem imagens externas, largura máx. 600 px, cabeçalho azul-escuro.
// É a ÚNICA função que gera o HTML: a pré-visualização da tela e o e-mail enviado saem daqui.
import { htmlParaTexto } from "./htmlSeguro.js";

export const ASSUNTO_PADRAO = "JTD Transportes | Solicitação de reajuste contratual";
export const SUBTITULO = "Comunicação de reajuste contratual";

const AZUL = "#01304a";
const FONTE = "font-family:Arial,Helvetica,sans-serif;";
const TEXTO = `${FONTE}font-size:15px;line-height:1.6;color:#1f2a33;`;

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Aplica estilos inline às tags do conteúdo JÁ SANITIZADO (Outlook/Gmail ignoram <style>). */
export function estilizarCorpo(corpoSanitizado) {
  return String(corpoSanitizado)
    .replace(/<p>/g, `<p style="margin:0 0 14px;${TEXTO}">`)
    .replace(/<ul>/g, `<ul style="margin:0 0 14px;padding:0 0 0 22px;${TEXTO}">`)
    .replace(/<ol>/g, `<ol style="margin:0 0 14px;padding:0 0 0 22px;${TEXTO}">`)
    .replace(/<li>/g, `<li style="margin:0 0 6px;${TEXTO}">`)
    .replace(/<strong>/g, `<strong style="font-weight:700;color:${AZUL};">`);
}

/**
 * corpo: conteúdo editado, já passado por sanitizarCorpo().
 * assinante: nome do funcionário que envia (opcional).
 * teste: { destino } → faixa discreta "e-mail de teste" ACIMA do cartão (o cartão e o corpo são idênticos ao real).
 */
export function montarEmailComunicado({ assunto, corpo, assinante = null, teste = null }) {
  const nome = String(assinante || "").trim();
  const preheader = htmlParaTexto(corpo).replace(/\s+/g, " ").slice(0, 140);
  const assinaturaHtml = `${nome ? `<strong style="${FONTE}font-size:15px;color:${AZUL};">${esc(nome)}</strong><br>` : ""}<span style="${FONTE}font-size:14px;color:#51626e;">JTD Transportes</span>`;

  const html = `<!doctype html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
<title>${esc(assunto)}</title>
<!--[if mso]><style>table,td,p,li{font-family:Arial,Helvetica,sans-serif!important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f3f5f7;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f5f7;">
  <tr><td align="center" style="padding:24px 12px;">
    ${teste ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;"><tr><td style="padding:0 4px 10px;${FONTE}font-size:12px;line-height:1.5;color:#8a5a00;"><strong>E-MAIL DE TESTE</strong> — enviado somente para ${esc(teste.destino)}. O cliente não recebeu esta mensagem.</td></tr></table>` : ""}
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e3e8ec;border-radius:12px;">
      <tr><td align="center" bgcolor="${AZUL}" style="background:${AZUL};border-radius:12px 12px 0 0;padding:26px 28px 22px;">
        <p style="margin:0;${FONTE}font-size:20px;line-height:1.3;font-weight:700;letter-spacing:3px;color:#ffffff;">JTD TRANSPORTES</p>
        <p style="margin:6px 0 0;${FONTE}font-size:13px;line-height:1.4;color:#bcd3e3;letter-spacing:.4px;">${esc(SUBTITULO)}</p>
      </td></tr>
      <tr><td style="padding:30px 32px 8px;${TEXTO}">
        ${estilizarCorpo(corpo)}
      </td></tr>
      <tr><td style="padding:4px 32px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-left:3px solid ${AZUL};padding:2px 0 2px 12px;${FONTE}line-height:1.5;">${assinaturaHtml}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:16px 32px 22px;border-top:1px solid #eef1f4;${FONTE}font-size:12px;line-height:1.5;color:#8a99a4;">
        JTD Transportes · www.jtdtransportes.com.br<br>
        Esta mensagem foi enviada pela JTD Transportes ao destinatário indicado. Para falar conosco, basta responder a este e-mail.
      </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body>
</html>`;

  const texto = [
    teste ? `*** E-MAIL DE TESTE — enviado somente para ${teste.destino}. O cliente não recebeu esta mensagem. ***\n` : "",
    "JTD TRANSPORTES",
    SUBTITULO,
    "",
    htmlParaTexto(corpo),
    "",
    "--",
    nome || null,
    "JTD Transportes",
    "www.jtdtransportes.com.br",
  ].filter((l) => l !== null).join("\n").replace(/^\n/, "");

  return { html, texto };
}
