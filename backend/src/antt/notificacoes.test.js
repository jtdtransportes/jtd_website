// Notificações por e-mail de gatilhos — sem rede, sem banco e SEM e-mails reais (o Resend é simulado).
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { recalcularIndicadores, carregarIndicadores } from "./triggers.js";
import {
  assinaturaValida, detectarEventos, enviarEmailTeste, enviarPendentes, mailer, processarNotificacoes, salvarConfigNotificacoes, urlModulo, webhookResend,
} from "./notificacoes.js";
import { montarEmailGatilho } from "./emailGatilho.js";
import { instalarRepoEmMemoria, mesInteiro } from "./fixtures/fakeRepo.js";

const HOJE = "2026-11-11";
const TESTE = "eu.pessoal@exemplo.com";
const OFICIAL = "responsavel@jtdlog.com.br";
// jan: NE 6,00 · NO 6,20 → NE/NO 6,10 · BA 6,30
const JAN = mesInteiro(2026, 1, "6.00", "6.20", "6.30");

/** Resend simulado: registra cada chamada; `respostas` define o resultado das próximas chamadas. */
function resendSimulado(t, respostas = []) {
  const chamadas = [];
  t.mock.method(mailer, "enviar", async (msg) => {
    chamadas.push(msg);
    const r = respostas.shift();
    return r || { id: `re-${chamadas.length}`, error: null };
  });
  return chamadas;
}
async function preparar(t, semanas, config = {}) {
  const db = instalarRepoEmMemoria(t, { semanas, config: { notif_email_teste: TESTE, ...config } });
  await recalcularIndicadores({ hoje: HOJE });
  return db;
}
const eventosDe = async () => { const { series, limite } = await carregarIndicadores(); return detectarEventos(series, limite); };

// ------------------------------------------------------------------ detecção (regra inclusiva, por indicador)
test("gatilho de exatamente +5% e acima de +5% (NE/NO)", async (t) => {
  await preparar(t, [...JAN, ...mesInteiro(2026, 2, "6.30", "6.51", "6.30")]);       // NE/NO 6,405 = 6,10 × 1,05
  let ev = (await eventosDe()).filter((e) => e.indicador === "NENO");
  assert.deepEqual(ev.map((e) => [e.chave_evento, e.direcao, e.variacao_pct, e.ref_mes]), [["NENO:2026-01:ALTA", "ALTA", "5.0000", 2]]);
  t.mock.restoreAll();
  await preparar(t, [...JAN, ...mesInteiro(2026, 2, "6.50", "6.70", "6.30")]);       // 6,60 → +8,20%
  ev = (await eventosDe()).filter((e) => e.indicador === "NENO");
  assert.deepEqual(ev.map((e) => [e.direcao, e.variacao_pct]), [["ALTA", "8.1967"]]);
});

test("gatilho de exatamente −5% e abaixo de −5% (NE/NO)", async (t) => {
  await preparar(t, [...JAN, ...mesInteiro(2026, 2, "5.70", "5.89", "6.30")]);       // 5,795 = 6,10 × 0,95
  let ev = (await eventosDe()).filter((e) => e.indicador === "NENO");
  assert.deepEqual(ev.map((e) => [e.direcao, e.variacao_pct]), [["BAIXA", "-5.0000"]]);
  t.mock.restoreAll();
  await preparar(t, [...JAN, ...mesInteiro(2026, 2, "5.50", "5.70", "6.30")]);       // 5,60 → −8,20%
  ev = (await eventosDe()).filter((e) => e.indicador === "NENO");
  assert.deepEqual(ev.map((e) => [e.direcao, e.variacao_pct]), [["BAIXA", "-8.1967"]]);
});

test("cada indicador usa a sua referência: Bahia sobe +5% sozinha, sem somar com outras localidades", async (t) => {
  await preparar(t, [...JAN, ...mesInteiro(2026, 2, "6.05", "6.25", "6.615")]);      // BA 6,615 = 6,30 × 1,05; NE/NO +0,82%
  const ev = await eventosDe();
  assert.deepEqual(ev.map((e) => [e.indicador, e.direcao, e.variacao_pct, e.preco_referencia]), [["BA", "ALTA", "5.0000", "6.300000"]]);
});

test("o mesmo gatilho não se repete nos meses seguintes enquanto a referência não muda", async (t) => {
  // BA acima de +5% em fev, mar e abr (NE/NO estável) → um único evento
  await preparar(t, [...JAN, ...mesInteiro(2026, 2, "6.05", "6.25", "6.70"), ...mesInteiro(2026, 3, "6.05", "6.25", "6.75"), ...mesInteiro(2026, 4, "6.05", "6.25", "6.80")]);
  const ev = (await eventosDe()).filter((e) => e.indicador === "BA");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].ref_mes, 2);
});

// ------------------------------------------------------------------ ativação, envio e duplicidade
test("1ª ativação: gatilhos antigos vão para o histórico sem e-mail; só eventos novos notificam", async (t) => {
  const db = await preparar(t, [...JAN, ...mesInteiro(2026, 2, "6.50", "6.70", "6.90")]); // fev: NE/NO e BA já cruzaram
  const enviados = resendSimulado(t);
  await salvarConfigNotificacoes({ ativo: true }, 1);
  assert.ok(db.eventos.length >= 2);
  assert.ok(db.eventos.every((e) => e.historico));
  await processarNotificacoes();
  assert.equal(enviados.length, 0);
  assert.equal(db.notificacoes.length, 0);
});

test("vários indicadores na mesma sincronização → UM e-mail consolidado (assunto genérico); sem duplicar depois", async (t) => {
  const db = await preparar(t, JAN);
  const enviados = resendSimulado(t);
  await salvarConfigNotificacoes({ ativo: true }, 1);
  db.semanas.push(...mesInteiro(2026, 2, "6.50", "6.70", "6.90"));                      // nova publicação: NE/NO +8,20%, BA +9,52%, NE e NO também
  await recalcularIndicadores({ hoje: HOJE });
  const r = await processarNotificacoes();
  assert.equal(r.notificados, 4);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].to, TESTE);
  assert.equal(enviados[0].subject, "JTD Transportes | Novo gatilho de reajuste — Diesel S10");
  assert.match(enviados[0].text, /Tipo: Múltiplos gatilhos/);
  assert.match(enviados[0].text, /Limite monitorado: ±5%/);
  assert.match(enviados[0].text, /Situação: Aguardando análise/);
  const n = db.notificacoes[0];
  assert.deepEqual([n.status, n.tipo_alerta, n.indicadores.split(",").sort().join(",")], ["ENVIADO", "Múltiplos gatilhos", "BA,N,NE,NENO"]);
  // novas sincronizações e "reinicialização" (estado vem do banco): nada é reenviado
  await processarNotificacoes();
  await recalcularIndicadores({ hoje: HOJE });
  await processarNotificacoes();
  assert.equal(enviados.length, 1);
  assert.equal(db.notificacoes.length, 1);
});

test("envio interrompido no meio (servidor caiu) não é reenviado sozinho: vira falha para conferência", async (t) => {
  const db = await preparar(t, JAN);
  const enviados = resendSimulado(t);
  await salvarConfigNotificacoes({ ativo: true }, 1);
  db.notificacoes.push({ id: 1, tipo: "GATILHO", modo: "TESTE", destinatario: TESTE, status: "ENVIANDO", tentativas: 1, proxima_tentativa_em: null, criado_em: db.agora, atualizado_em: db.agora });
  db.agora += 20 * 60000;
  await enviarPendentes();
  assert.equal(db.notificacoes[0].status, "FALHA");
  assert.match(db.notificacoes[0].erro, /interrompido/i);
  assert.equal(enviados.length, 0);
});

test("falha temporária do Resend: registra, espera e tenta de novo (chave de idempotência por tentativa)", async (t) => {
  const db = await preparar(t, JAN);
  const enviados = resendSimulado(t, [{ id: null, error: { name: "internal_server_error", message: "Serviço indisponível", statusCode: 500 } }]);
  await salvarConfigNotificacoes({ ativo: true }, 1);
  db.semanas.push(...mesInteiro(2026, 2, "6.50", "6.70", "6.30"));
  await recalcularIndicadores({ hoje: HOJE });
  await processarNotificacoes();
  const n = db.notificacoes[0];
  assert.deepEqual([n.status, n.tentativas], ["FALHA", 1]);
  assert.match(n.erro, /Serviço indisponível.*HTTP 500/);
  assert.ok(n.proxima_tentativa_em > db.agora);
  await enviarPendentes();                                   // ainda não venceu a espera
  assert.equal(enviados.length, 1);
  db.agora += 16 * 60000;
  await enviarPendentes();
  assert.equal(enviados.length, 2);
  assert.deepEqual([n.status, n.tentativas, n.provedor_id], ["ENVIADO", 2, "re-2"]);
  assert.notEqual(enviados[0].idempotencyKey, enviados[1].idempotencyKey);
});

test("erro definitivo (validação, HTTP 422) não fica tentando de novo", async (t) => {
  const db = await preparar(t, JAN);
  const enviados = resendSimulado(t, [{ id: null, error: { name: "validation_error", message: "Domínio não verificado", statusCode: 422 } }]);
  await salvarConfigNotificacoes({ ativo: true }, 1);
  db.semanas.push(...mesInteiro(2026, 2, "6.50", "6.70", "6.30"));
  await recalcularIndicadores({ hoje: HOJE });
  await processarNotificacoes();
  db.agora += 24 * 3600000;
  await enviarPendentes();
  assert.equal(enviados.length, 1);
  assert.equal(db.notificacoes[0].proxima_tentativa_em, null);
});

// ------------------------------------------------------------------ modo Teste × Produção
test("modo Teste NUNCA envia ao e-mail oficial; Produção exige confirmação explícita e e-mail oficial", async (t) => {
  const db = await preparar(t, JAN, { notif_email_oficial: OFICIAL });
  const enviados = resendSimulado(t);
  await salvarConfigNotificacoes({ ativo: true }, 1);
  db.semanas.push(...mesInteiro(2026, 2, "6.50", "6.70", "6.30"));
  await recalcularIndicadores({ hoje: HOJE });
  await processarNotificacoes();
  assert.deepEqual(enviados.map((e) => e.to), [TESTE]);                               // oficial cadastrado, mas modo Teste
  await assert.rejects(() => salvarConfigNotificacoes({ modo: "PRODUCAO" }, 1), /confirmação explícita/);
  await assert.rejects(() => salvarConfigNotificacoes({ modo: "PRODUCAO", confirmar_producao: true, email_oficial: "" }, 1), /e-mail oficial/);
  await salvarConfigNotificacoes({ modo: "PRODUCAO", confirmar_producao: true }, 1);
  db.semanas.push(...mesInteiro(2026, 3, "7.10", "7.30", "6.30"));                    // novo gatilho em março
  await recalcularIndicadores({ hoje: HOJE });
  await processarNotificacoes();
  assert.equal(enviados.at(-1).to, OFICIAL);
  // volta para Teste com uma falha pendente: a nova tentativa vai para o e-mail de teste, nunca o oficial
  db.notificacoes.push({ id: 99, tipo: "GATILHO", modo: "PRODUCAO", destinatario: OFICIAL, status: "PENDENTE", tentativas: 0, proxima_tentativa_em: null, criado_em: db.agora, atualizado_em: db.agora });
  await salvarConfigNotificacoes({ modo: "TESTE" }, 1);
  await enviarPendentes();
  assert.equal(enviados.at(-1).to, TESTE);
  assert.ok(!enviados.slice(0, 1).concat(enviados.slice(2)).some((e) => e.to === OFICIAL));
});

test("notificações desligadas: o evento fica registrado (histórico), mas nenhum e-mail sai", async (t) => {
  const db = await preparar(t, JAN);
  const enviados = resendSimulado(t);
  db.semanas.push(...mesInteiro(2026, 2, "6.50", "6.70", "6.30"));
  await recalcularIndicadores({ hoje: HOJE });
  await processarNotificacoes();
  assert.equal(enviados.length, 0);
  assert.ok(db.eventos.length > 0 && db.eventos.every((e) => e.historico));
});

// ------------------------------------------------------------------ e-mail de teste (botão)
test("e-mail de teste: exige e-mail de teste, usa o modelo real com [TESTE] e não cria gatilho nem marco", async (t) => {
  const db = await preparar(t, JAN, { notif_email_teste: "", notif_email_oficial: OFICIAL, notif_modo: "PRODUCAO" });
  const enviados = resendSimulado(t);
  await assert.rejects(() => enviarEmailTeste(7), /e-mail de teste/);
  await salvarConfigNotificacoes({ email_teste: TESTE }, 7);
  const marcosAntes = JSON.stringify(db.marcos);
  const r = await enviarEmailTeste(7);
  assert.equal(enviados[0].to, TESTE);                                               // mesmo em Produção, teste vai ao e-mail de teste
  assert.match(enviados[0].subject, /^\[TESTE\] JTD Transportes \| Novo gatilho de reajuste — Diesel S10$/);
  assert.match(enviados[0].html, /E-MAIL DE TESTE/);
  assert.match(enviados[0].text, /dados simulados/);
  assert.deepEqual([r.provedor_id, db.notificacoes[0].tipo, db.notificacoes[0].status], ["re-1", "TESTE", "ENVIADO"]);
  assert.equal(db.eventos.length, 0);
  assert.equal(JSON.stringify(db.marcos), marcosAntes);
});

test("e-mail de teste recusado pelo Resend: mostra o erro real com segurança e registra a falha", async (t) => {
  const db = await preparar(t, JAN);
  resendSimulado(t, [{ id: null, error: { name: "validation_error", message: "The jtdlog.com.br domain is not verified (key re_abcdefghijklmnop)", statusCode: 403 } }]);
  await assert.rejects(() => enviarEmailTeste(7), (e) => e.status === 502 && /not verified/.test(e.message) && !/re_abcdefghijklmnop/.test(e.message));
  assert.equal(db.notificacoes[0].status, "FALHA");
});

test("e-mail de teste tem limite de frequência", async (t) => {
  await preparar(t, JAN);
  resendSimulado(t);
  for (let i = 0; i < 3; i++) await enviarEmailTeste(7);
  await assert.rejects(() => enviarEmailTeste(7), (e) => e.status === 429);
});

// ------------------------------------------------------------------ webhook, modelo e link
test("webhook do Resend: assinatura válida marca ENTREGUE; assinatura inválida é recusada", async (t) => {
  const db = await preparar(t, JAN);
  resendSimulado(t);
  await enviarEmailTeste(7);
  const segredo = `whsec_${Buffer.from("segredo-de-teste-123").toString("base64")}`;
  process.env.RESEND_WEBHOOK_SECRET = segredo;
  t.after(() => { delete process.env.RESEND_WEBHOOK_SECRET; });
  const corpo = JSON.stringify({ type: "email.delivered", data: { email_id: "re-1" } });
  const id = "msg_1", ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac("sha256", Buffer.from("segredo-de-teste-123")).update(`${id}.${ts}.${corpo}`).digest("base64");
  assert.equal(assinaturaValida({ id, timestamp: ts, assinatura: `v1,${sig}`, corpo, segredo }), true);
  assert.equal(assinaturaValida({ id, timestamp: ts, assinatura: `v1,${sig}`, corpo: corpo.replace("delivered", "bounced"), segredo }), false);
  const resposta = () => { const r = { code: 200 }; r.status = (c) => { r.code = c; return r; }; r.json = () => r; return r; };
  const req = (h, body) => ({ body: Buffer.from(body), get: (k) => h[k] });
  const ruim = await webhookResend(req({ "svix-id": id, "svix-timestamp": ts, "svix-signature": "v1,AAAA" }, corpo), resposta());
  assert.equal(ruim.code, 401);
  const ok = await webhookResend(req({ "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}` }, corpo), resposta());
  assert.equal(ok.code, 200);
  assert.equal(db.notificacoes[0].status, "ENTREGUE");
});

test("modelo do e-mail: HTML e texto, link público (nunca localhost) e conteúdo escapado", (t) => {
  t.after(() => { delete process.env.ANTT_APP_URL; });
  process.env.ANTT_APP_URL = "http://localhost:3000/#/antt";
  assert.equal(urlModulo(), null);
  delete process.env.ANTT_APP_URL;
  assert.equal(urlModulo(), "https://www.jtdtransportes.com.br/#/antt");
  const m = montarEmailGatilho({ eventos: [{ indicador: "BA", direcao: "BAIXA", ref_ano: 2026, ref_mes: 7, mes_parcial: false }], url: "https://www.jtdtransportes.com.br/#/antt?a=<b>" });
  assert.match(m.texto, /Tipo: Redução/);
  assert.match(m.texto, /Data de referência: Julho de 2026/);
  assert.match(m.html, /Acessar módulo ANTT/);
  assert.ok(!m.html.includes("<b>"));
  assert.ok(!m.html.includes("localhost"));
  assert.match(m.html, /não representa aplicação automática de reajuste/);
});
