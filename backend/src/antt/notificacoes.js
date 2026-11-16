// Notificações por e-mail de novos gatilhos (±limite) do Diesel S10 — BA, NE, NO e NE/NO.
//
// Fluxo (roda no servidor, ao fim de cada sincronização/importação da ANP e no agendador):
//   1. detectarEventos(): para cada indicador, o 1º mês que atinge ≥ +L% ou ≤ −L% contra a SUA referência de marco
//      (mesma fórmula e mesma comparação exata já usadas no módulo; nada é recalculado de outro jeito).
//   2. Cada evento tem chave única (indicador:marco de referência:direção) → nunca é registrado nem avisado duas vezes.
//   3. Eventos novos, com o monitoramento ativo, viram UMA notificação consolidada gravada como PENDENTE no banco
//      ANTES do envio (reiniciar o servidor não dispara de novo).
//   4. O envio usa o Resend com chave de idempotência; falhas temporárias são reenviadas com espera crescente.
//   5. Modo TESTE: o destinatário é SEMPRE o e-mail de teste (decidido na hora do envio). Nunca o oficial.
// Eventos detectados antes da ativação (ou com as notificações desligadas) ficam no histórico, sem e-mail.
import crypto from "crypto";
import { Resend } from "resend";
import { z } from "zod";
import * as D from "./decimal.js";
import repo from "../repositories/antt.repository.js";
import comunicadosRepo from "../repositories/anttComunicados.repository.js";
import { getConfig } from "./config.js";
import { carregarIndicadores } from "./triggers.js";
import { montarEmailGatilho } from "./emailGatilho.js";

export const INDICADORES = ["BA", "NE", "N", "NENO"];
export const MAX_TENTATIVAS = 5;
const ESPERA_MIN = [15, 60, 180, 360, 720];          // espera antes da tentativa seguinte
const INTERROMPIDO_MIN = 15;                          // ENVIANDO há mais que isso = processo caiu no meio do envio
const TESTES_POR_JANELA = { max: 3, minutos: 10 };

const erroHttp = (status, message) => Object.assign(new Error(message), { status });
const pad = (n) => String(n).padStart(2, "0");

// ------------------------------------------------------------------ provedor (único ponto que fala com o Resend)
// cc, replyTo e attachments são opcionais (usados pelo "Comunicar reajuste"); os alertas continuam iguais.
export const mailer = {
  cliente: null,
  async enviar({ from, to, subject, html, text, idempotencyKey, tags, cc, replyTo, attachments }) {
    if (!process.env.RESEND_API_KEY) return { id: null, error: { message: "RESEND_API_KEY não configurada no servidor.", statusCode: 0 } };
    this.cliente ??= new Resend(process.env.RESEND_API_KEY);
    const msg = { from, to: Array.isArray(to) ? to : [to], subject, html, text, tags };
    if (cc?.length) msg.cc = cc;
    if (replyTo) msg.replyTo = replyTo;
    if (attachments?.length) msg.attachments = attachments;
    const { data, error } = await this.cliente.emails.send(msg, { idempotencyKey });
    return { id: data?.id || null, error: error || null };
  },
};

export function remetente() {
  const email = (process.env.MAIL_FROM_EMAIL || "onboarding@resend.dev").trim().replace(/^"|"$/g, "");
  return email.includes("<") ? email : `${process.env.MAIL_FROM_NAME || "JTD Transportes"} <${email}>`;
}

/** Endereço público do módulo para o botão do e-mail. Nunca localhost/HTTP: nesse caso o e-mail vai sem botão. */
export function urlModulo() {
  const u = (process.env.ANTT_APP_URL || "https://www.jtdtransportes.com.br/#/antt").trim();
  try {
    const x = new URL(u);
    if (x.protocol !== "https:" || ["localhost", "127.0.0.1", "0.0.0.0"].includes(x.hostname)) return null;
    return u;
  } catch { return null; }
}

/** Mensagem de erro segura (sem chaves, cabeçalhos ou detalhes internos). */
export function erroSeguro(error) {
  const msg = String(error?.message || error || "Falha desconhecida no envio.").replace(/re_[A-Za-z0-9_]{8,}/g, "re_***").slice(0, 400);
  const codigo = error?.name ? ` (${error.name}${error.statusCode ? ` · HTTP ${error.statusCode}` : ""})` : "";
  return `${msg}${codigo}`;
}
/** Falhas temporárias (rede, limite de taxa, erro do provedor) podem ser repetidas; erros de validação não. */
const temporaria = (error) => !error?.statusCode || error.statusCode === 429 || error.statusCode >= 500;

// ------------------------------------------------------------------ detecção
/**
 * Eventos de gatilho por indicador. Referência de cada mês = marco vigente no mês anterior quando um novo marco
 * começa no próprio mês (é aí que o NE/NO cruza o limite), senão o marco do mês. BA, NE e NO usam o SEU preço no
 * mês do marco. Só o 1º mês que atinge o limite em cada (indicador, referência, direção) gera evento.
 */
export function detectarEventos(series, limite = 5, indicadores = INDICADORES) {
  const out = [];
  for (const k of indicadores) {
    const rows = [...(series[k] || [])].sort((a, b) => (a.ano * 12 + a.mes) - (b.ano * 12 + b.mes));
    const vistos = new Set();
    rows.forEach((row, i) => {
      const ref = row.marco_inicia_aqui ? rows[i - 1]?.marco_ref : row.marco_ref;
      if (!ref || ref.preco == null || (ref.ano === row.ano && ref.mes === row.mes)) return;
      const direcao = D.classificarGatilho(row.preco_medio, ref.preco, limite);   // comparação exata, inclusiva
      if (direcao === "SEM_GATILHO") return;
      const chave = `${k}:${ref.ano}-${pad(ref.mes)}:${direcao}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      out.push({
        chave_evento: chave, indicador: k, direcao, ref_ano: row.ano, ref_mes: row.mes, marco_ref_ano: ref.ano, marco_ref_mes: ref.mes,
        preco_referencia: ref.preco, preco_apurado: row.preco_medio, variacao_pct: D.variacaoPct(row.preco_medio, ref.preco), mes_parcial: !row.mes_completo,
      });
    });
  }
  return out;
}

// ------------------------------------------------------------------ envio
const destinatarioAtual = (cfg) => (cfg.notif_modo === "PRODUCAO" ? cfg.notif_email_oficial : cfg.notif_email_teste) || null;

async function enviarNotificacao(n, cfg) {
  const destino = destinatarioAtual(cfg);
  const modo = cfg.notif_modo;
  if (!destino) {
    await repo.atualizarNotificacao(n.id, { status: "FALHA", erro: `Nenhum e-mail configurado para o modo ${modo === "PRODUCAO" ? "Produção" : "Teste"}.`, tentativas: n.tentativas + 1, espera_min: 60 });
    return "SEM_DESTINATARIO";
  }
  // Trava final: em modo TESTE só existe um destino possível.
  if (modo !== "PRODUCAO" && destino !== cfg.notif_email_teste) throw new Error("Bloqueado: modo Teste só envia ao e-mail de teste.");
  const eventos = await repo.eventosDaNotificacao(n.id);
  const { assunto, html, texto, tipo } = montarEmailGatilho({ eventos, url: urlModulo(), limite: Number(cfg.limite_gatilho_pct) });
  const tentativa = n.tentativas + 1;
  await repo.atualizarNotificacao(n.id, { status: "ENVIANDO", tentativas: tentativa, destinatario: destino, modo, assunto, tipo_alerta: tipo, erro: null });
  let res;
  try {
    res = await mailer.enviar({ from: remetente(), to: destino, subject: assunto, html, text: texto, idempotencyKey: `antt-notif-${n.id}-${tentativa}`, tags: [{ name: "modulo", value: "antt" }, { name: "notificacao", value: String(n.id) }] });
  } catch (e) {
    res = { id: null, error: { message: e.message } };                     // erro de rede: temporário
  }
  if (res.error) {
    const repetir = temporaria(res.error) && tentativa < MAX_TENTATIVAS;
    await repo.atualizarNotificacao(n.id, { status: "FALHA", erro: erroSeguro(res.error), espera_min: repetir ? ESPERA_MIN[tentativa - 1] : null });
    return "FALHA";
  }
  await repo.atualizarNotificacao(n.id, { status: "ENVIADO", provedor_id: res.id, enviado: true, erro: null });
  return "ENVIADO";
}

/** Envia notificações pendentes e repete falhas temporárias vencidas. Seguro para rodar a qualquer momento. */
export async function enviarPendentes() {
  const cfg = await getConfig();
  await repo.marcarEnviosInterrompidos(INTERROMPIDO_MIN);
  if (!cfg.notif_ativo) return { enviados: 0, falhas: 0, aguardando: "notificações desativadas" };
  const r = { enviados: 0, falhas: 0 };
  for (const n of await repo.notificacoesParaEnviar(MAX_TENTATIVAS)) {
    const s = await enviarNotificacao(n, cfg);
    if (s === "ENVIADO") r.enviados++; else r.falhas++;
  }
  return r;
}

/** Detecta eventos novos, registra, cria a notificação consolidada e envia. Chamado após cada sincronização. */
export async function processarNotificacoes() {
  const cfg = await getConfig();
  const { series, limite } = await carregarIndicadores();
  const eventos = detectarEventos(series, limite);
  const monitorando = Boolean(cfg.notif_ativo && cfg.notif_inicio);
  const novos = await repo.registrarEventosGatilho(eventos.map((e) => ({ ...e, historico: !monitorando })));
  const aNotificar = novos.filter((e) => !e.historico);
  let notificacaoId = null;
  if (aNotificar.length) {
    const tipo = aNotificar.length > 1 ? "MULTIPLOS" : aNotificar[0].direcao;
    notificacaoId = await repo.criarNotificacao({
      tipo: "GATILHO", modo: cfg.notif_modo, destinatario: destinatarioAtual(cfg) || "", tipo_alerta: tipo,
      indicadores: [...new Set(aNotificar.map((e) => e.indicador))].join(","), eventoIds: aNotificar.map((e) => e.id),
    });
    await repo.audit({ acao: "NOTIFICACAO_GATILHO_CRIADA", entidade: "antt_notificacoes", entidadeId: notificacaoId, depois: { eventos: aNotificar.map((e) => e.chave_evento) } });
  }
  const envio = await enviarPendentes();
  return { detectados: eventos.length, novos: novos.length, notificados: aNotificar.length, notificacao_id: notificacaoId, envio };
}

/** Versão que nunca derruba a sincronização (erros vão para o log). */
export async function processarNotificacoesSeguro() {
  try { return await processarNotificacoes(); } catch (e) { console.error("[ANTT] notificações:", e.message); return { erro: e.message }; }
}

// ------------------------------------------------------------------ e-mail de teste (botão)
export async function enviarEmailTeste(userId) {
  const cfg = await getConfig();
  if (!cfg.notif_email_teste) throw erroHttp(400, "Cadastre e salve o e-mail de teste antes de enviar.");
  if (await repo.contarTestesRecentes(userId, TESTES_POR_JANELA.minutos) >= TESTES_POR_JANELA.max) {
    throw erroHttp(429, `Limite de ${TESTES_POR_JANELA.max} e-mails de teste a cada ${TESTES_POR_JANELA.minutos} minutos. Aguarde um pouco.`);
  }
  const hoje = new Date();
  const simulados = [{ indicador: "NENO", direcao: "ALTA", ref_ano: hoje.getFullYear(), ref_mes: hoje.getMonth() + 1, mes_parcial: false }];
  const { assunto, html, texto, tipo } = montarEmailGatilho({ eventos: simulados, url: urlModulo(), teste: true, limite: Number(cfg.limite_gatilho_pct) });
  const id = await repo.criarNotificacao({ tipo: "TESTE", modo: "TESTE", destinatario: cfg.notif_email_teste, assunto, tipo_alerta: "ALTA", indicadores: "SIMULADO", eventoIds: [], criado_por: userId });
  await repo.atualizarNotificacao(id, { status: "ENVIANDO", tentativas: 1, tipo_alerta: tipo === "Redução" ? "BAIXA" : "ALTA" });
  let res;
  try {
    res = await mailer.enviar({ from: remetente(), to: cfg.notif_email_teste, subject: assunto, html, text: texto, idempotencyKey: `antt-teste-${id}`, tags: [{ name: "modulo", value: "antt" }, { name: "tipo", value: "teste" }] });
  } catch (e) { res = { id: null, error: { message: e.message } }; }
  if (res.error) {
    const erro = erroSeguro(res.error);
    await repo.atualizarNotificacao(id, { status: "FALHA", erro });
    await repo.audit({ usuarioId: userId, acao: "EMAIL_TESTE_FALHOU", entidade: "antt_notificacoes", entidadeId: id, depois: { erro } });
    throw erroHttp(502, `O Resend recusou o envio: ${erro}`);
  }
  await repo.atualizarNotificacao(id, { status: "ENVIADO", provedor_id: res.id, enviado: true });
  await repo.audit({ usuarioId: userId, acao: "EMAIL_TESTE_ENVIADO", entidade: "antt_notificacoes", entidadeId: id, depois: { destinatario: cfg.notif_email_teste, provedor_id: res.id } });
  return { id, provedor_id: res.id, destinatario: cfg.notif_email_teste };
}

// ------------------------------------------------------------------ configuração (somente administradores)
const email = z.union([z.literal(""), z.string().trim().toLowerCase().email("e-mail inválido").max(254)]);
const configSchema = z.object({
  ativo: z.boolean().optional(),
  modo: z.enum(["TESTE", "PRODUCAO"]).optional(),
  email_teste: email.optional(),
  email_oficial: email.optional(),
  confirmar_producao: z.boolean().optional(),
});

export async function obterNotificacoes() {
  const cfg = await getConfig();
  const [historico, eventos] = await Promise.all([repo.listarNotificacoes(40), repo.listarEventosGatilho(60)]);
  return {
    config: { ativo: cfg.notif_ativo, modo: cfg.notif_modo, email_teste: cfg.notif_email_teste, email_oficial: cfg.notif_email_oficial, inicio_monitoramento: cfg.notif_inicio || null },
    servidor: { resend_configurado: Boolean(process.env.RESEND_API_KEY), webhook_configurado: Boolean(process.env.RESEND_WEBHOOK_SECRET), remetente: remetente(), url_modulo: urlModulo() },
    ultimo_envio: historico.find((n) => n.status !== "PENDENTE") || null,
    historico, eventos,
  };
}

export async function salvarConfigNotificacoes(input, userId, ip) {
  const r = configSchema.safeParse(input || {});
  if (!r.success) throw erroHttp(400, r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const v = r.data;
  const antes = await getConfig();
  const emailOficial = v.email_oficial !== undefined ? v.email_oficial : antes.notif_email_oficial;
  const emailTeste = v.email_teste !== undefined ? v.email_teste : antes.notif_email_teste;
  if (v.modo === "PRODUCAO" && antes.notif_modo !== "PRODUCAO") {
    if (v.confirmar_producao !== true) throw erroHttp(400, "Para ativar o modo Produção é necessária a confirmação explícita.");
    if (!emailOficial) throw erroHttp(400, "Cadastre o e-mail oficial do responsável antes de ativar o modo Produção.");
  }
  if (v.ativo === true && !(v.modo === "PRODUCAO" || antes.notif_modo === "PRODUCAO" ? emailOficial : emailTeste)) {
    throw erroHttp(400, "Cadastre o e-mail do modo selecionado antes de ativar as notificações.");
  }
  const salvar = { notif_email_teste: v.email_teste, notif_email_oficial: v.email_oficial, notif_modo: v.modo };
  for (const [k, val] of Object.entries(salvar)) if (val !== undefined) await repo.setConfig(k, String(val), userId);

  // 1ª ativação: marca o início do monitoramento e registra os gatilhos já existentes como histórico (sem e-mail).
  let linhaDeBase = null;
  if (v.ativo === true && !antes.notif_ativo) {
    if (!antes.notif_inicio) await repo.setConfig("notif_inicio", new Date().toISOString(), userId);
    const { series, limite } = await carregarIndicadores();
    const atuais = detectarEventos(series, limite);
    linhaDeBase = (await repo.registrarEventosGatilho(atuais.map((e) => ({ ...e, historico: true })))).length;
  }
  if (v.ativo !== undefined) await repo.setConfig("notif_ativo", String(v.ativo), userId);
  const depois = await getConfig();
  await repo.audit({
    usuarioId: userId, acao: "NOTIFICACOES_CONFIG", entidade: "antt_configuracoes", ip,
    antes: { ativo: antes.notif_ativo, modo: antes.notif_modo }, depois: { ativo: depois.notif_ativo, modo: depois.notif_modo, linha_de_base: linhaDeBase },
  });
  return obterNotificacoes();
}

// ------------------------------------------------------------------ webhook do Resend (entrega/falha confirmadas)
/** Verifica a assinatura Svix usada pelo Resend (cabeçalhos svix-id, svix-timestamp, svix-signature). */
export function assinaturaValida({ id, timestamp, assinatura, corpo, segredo = process.env.RESEND_WEBHOOK_SECRET, agora = Date.now() }) {
  if (!segredo || !id || !timestamp || !assinatura) return false;
  if (Math.abs(agora / 1000 - Number(timestamp)) > 300) return false;           // 5 min de tolerância
  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  const esperado = crypto.createHmac("sha256", chave).update(`${id}.${timestamp}.${corpo}`).digest();
  return assinatura.split(" ").some((parte) => {
    const [versao, sig] = parte.split(",");
    if (versao !== "v1" || !sig) return false;
    const recebido = Buffer.from(sig, "base64");
    return recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
  });
}

const EVENTOS_RESEND = {
  "email.delivered": { status: "ENTREGUE", entregue: true },
  "email.bounced": { status: "FALHA", erro: "Devolvido pelo servidor do destinatário (bounce)." },
  "email.failed": { status: "FALHA", erro: "O provedor não conseguiu enviar a mensagem." },
  "email.complained": { erro: "O destinatário marcou a mensagem como spam." },
  "email.delivery_delayed": { erro: "Entrega atrasada pelo servidor do destinatário (o provedor seguirá tentando)." },
};

export async function webhookResend(req, res) {
  if (!process.env.RESEND_WEBHOOK_SECRET) return res.status(404).json({ ok: false });
  const corpo = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!assinaturaValida({ id: req.get("svix-id"), timestamp: req.get("svix-timestamp"), assinatura: req.get("svix-signature"), corpo })) {
    return res.status(401).json({ ok: false });
  }
  try {
    const evt = JSON.parse(corpo);
    const acao = EVENTOS_RESEND[evt.type];
    const provedorId = evt.data?.email_id;
    if (acao && provedorId) {
      const campos = { ...acao, evento_provedor: evt.type };
      // Não é alerta automático → pode ser um comunicado de reajuste (envio manual a cliente).
      if (!(await repo.atualizarNotificacaoPorProvedor(provedorId, campos))) await comunicadosRepo.atualizarComunicadoPorProvedor(provedorId, campos);
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error("[ANTT] webhook Resend:", e.message);
    return res.status(400).json({ ok: false });
  }
}
