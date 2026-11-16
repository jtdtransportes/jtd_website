// "Comunicar reajuste" — sem rede, sem banco e SEM e-mails reais: o repositório é em memória e o Resend é simulado.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import repo from "../repositories/anttComunicados.repository.js";
import anttRepo from "../repositories/antt.repository.js";
import { mailer, webhookResend } from "./notificacoes.js";
import * as svc from "./comunicados.js";
import { sanitizarCorpo, htmlParaTexto } from "./htmlSeguro.js";
import { montarEmailComunicado, ASSUNTO_PADRAO } from "./emailComunicado.js";
import { verificarAcesso } from "../services/antt.service.js";
import { anttComunicar } from "../middlewares/antt.middleware.js";

// Trava dupla contra envio real: sem chave e com cliente Resend que explode se for chamado.
delete process.env.RESEND_API_KEY;
mailer.cliente = { emails: { send: () => { throw new Error("ENVIO REAL BLOQUEADO NOS TESTES"); } } };

const USUARIO = { id: 7, nome: "Ana Souza", email: "ana.teste@exemplo.com" };
const CLIENTE = { nome: "Cliente Alfa Ltda", email_principal: "compras@alfa.com.br", contato_nome: "Carlos", emails_cc: ["financeiro@alfa.com.br"], observacoes: "", ativo: true };
const CORPO = "<p>Prezado(a) Carlos,</p><p>Propomos o reajuste de <strong>8,5%</strong>.</p><ul><li>Item um</li></ul><p>Atenciosamente,</p>";

/** Repositório em memória (substitui os métodos reais via t.mock). */
function repoEmMemoria(t) {
  const db = { clientes: [], comunicados: [], auditoria: [], seq: { c: 0, m: 0 } };
  const m = (obj, nome, fn) => t.mock.method(obj, nome, fn);
  const pub = (c) => c && !c.excluido && ({ id: c.id, nome: c.nome, email_principal: c.email_principal, contato_nome: c.contato_nome || null, emails_cc: [...(c.emails_cc || [])], observacoes: c.observacoes || null, ativo: c.ativo, tem_cadastro: true });
  m(anttRepo, "audit", async (a) => { db.auditoria.push(a); });
  m(repo, "usuario", async (id) => (id === USUARIO.id ? { ...USUARIO } : null));
  m(repo, "listarClientes", async ({ busca = "", incluirInativos = true } = {}) => db.clientes
    .filter((c) => !c.excluido && (incluirInativos || c.ativo) && (!busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || c.email_principal.includes(busca)))
    .map(pub));
  m(repo, "clientePorId", async (id) => pub(db.clientes.find((c) => c.id === id)) || null);
  m(repo, "criarCliente", async (d) => {
    const ex = db.clientes.find((c) => c.nome.toLowerCase() === d.nome.toLowerCase());
    if (ex && !ex.excluido) throw Object.assign(new Error("dup"), { code: "DUPLICADO" });
    if (ex) { Object.assign(ex, d, { excluido: false }); return { id: ex.id, reaproveitado: true }; }
    const id = ++db.seq.c;
    db.clientes.push({ ...d, id, excluido: false });
    return { id, reaproveitado: false };
  });
  m(repo, "atualizarCliente", async (id, d) => { const c = db.clientes.find((x) => x.id === id && !x.excluido); if (!c) return false; Object.assign(c, d); return true; });
  m(repo, "excluirCliente", async (id) => { const c = db.clientes.find((x) => x.id === id); c.excluido = true; c.ativo = false; return true; });
  m(repo, "criarComunicado", async (c) => {
    if (db.comunicados.some((x) => x.chave_envio === c.chave_envio)) throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
    const id = ++db.seq.m;
    db.comunicados.push({ ...structuredClone(c), id, status: "ENVIANDO", criado_em: Date.now() });
    return id;
  });
  m(repo, "atualizarStatusComunicado", async (id, campos) => {
    const c = db.comunicados.find((x) => x.id === id);
    for (const k of ["status", "provedor_id", "evento_provedor", "erro"]) if (campos[k] !== undefined) c[k] = campos[k];
    if (campos.entregue) c.entregue_em = Date.now();
  });
  m(repo, "atualizarComunicadoPorProvedor", async (pid, campos) => {
    const c = db.comunicados.find((x) => x.provedor_id === pid);
    if (!c) return false;
    const { status, ...resto } = campos;
    Object.assign(c, resto, status && !(c.status === "FALHA" && status === "ENTREGUE") ? { status } : {});
    return true;
  });
  m(repo, "envioRecenteIdentico", async (hash, min) => db.comunicados.find((c) => c.conteudo_sha256 === hash && c.modo === "REAL" && c.status !== "FALHA" && c.criado_em > Date.now() - min * 60000)?.id || null);
  m(repo, "contarTestesRecentes", async (uid) => db.comunicados.filter((c) => c.modo === "TESTE" && c.enviado_por === uid).length);
  m(repo, "listarComunicados", async ({ clienteId, modo } = {}) => db.comunicados.filter((c) => (!clienteId || c.cliente_id === clienteId) && (!modo || c.modo === modo)).reverse());
  m(repo, "obterComunicado", async (id) => db.comunicados.find((c) => c.id === id) || null);
  m(repo, "clientesDoHistorico", async () => []);
  return db;
}

/** Resend simulado: registra as chamadas. */
function resendSimulado(t, respostas = []) {
  const chamadas = [];
  t.mock.method(mailer, "enviar", async (msg) => { chamadas.push(msg); return respostas.shift() || { id: `re-${chamadas.length}`, error: null }; });
  return chamadas;
}

const pdf = (nome = "proposta.pdf", extra = "") => ({ originalname: nome, buffer: Buffer.from(`%PDF-1.7 conteudo ${extra}`) });
const png = (nome = "grafico.png") => ({ originalname: nome, buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("dados")]) });
const xlsx = (nome = "tabela.xlsx", macro = false) => ({ originalname: nome, buffer: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(`[Content_Types].xml xl/workbook.xml ${macro ? "xl/vbaProject.bin" : ""}`)]) });

async function comCliente(t, extra = {}) {
  const db = repoEmMemoria(t);
  const { cliente } = await svc.criarCliente({ ...CLIENTE, ...extra }, USUARIO.id, "127.0.0.1");
  return { db, cliente };
}
const mensagem = (cliente, extra = {}) => ({
  cliente_id: cliente?.id, assunto: ASSUNTO_PADRAO, corpo_html: CORPO, percentual: "8,5", data_vigencia: "2026-12-01", contrato_ref: "CT-2024/015",
  chave_envio: crypto.randomUUID(), destinatario_esperado: cliente?.email_principal, confirmar: true, ...extra,
});

// ================================================================== sanitização do conteúdo editado
test("sanitização: remove scripts, eventos, estilos e links; mantém parágrafos, negrito e listas", () => {
  const sujo = `<p style="color:red" onclick="alert(1)">Olá <b>cliente</b> <i>querido</i></p><script>alert('x')</script>
    <img src=x onerror=alert(1)><a href="javascript:alert(1)">clique</a><iframe src="https://mal.example"></iframe>
    <ul class="x"><li>um</li><li><p>dois</p></li></ul><style>body{display:none}</style><div>linha<br>quebra</div>`;
  const limpo = sanitizarCorpo(sujo);
  assert.equal(limpo, "<p>Olá <strong>cliente</strong> <em>querido</em></p><p>clique</p><ul><li>um</li><li>dois</li></ul><p>linha<br>quebra</p>");
  assert.doesNotMatch(limpo, /script|onerror|onclick|javascript|iframe|style|href|src=/i);
});

test("sanitização: tags sempre balanceadas, texto solto vira parágrafo e entidades são escapadas", () => {
  assert.equal(sanitizarCorpo("texto solto <strong>negrito sem fechar"), "<p>texto solto <strong>negrito sem fechar</strong></p>");
  assert.equal(sanitizarCorpo("</p></strong><p>a</p></ul>"), "<p>a</p>");
  assert.equal(sanitizarCorpo("<p>5 < 6 & 7 > 3 &amp; &nbsp;fim</p>"), "<p>5 &lt; 6 &amp; 7 &gt; 3 &amp; &nbsp;fim</p>");
  assert.equal(sanitizarCorpo("<p></p><p><br></p><p>&nbsp;</p><ul><li> </li></ul>"), "");
  assert.equal(sanitizarCorpo('<p>"aspas"</p><!-- comentário --><p>x</p>'), "<p>&quot;aspas&quot;</p><p>x</p>");
  assert.equal(sanitizarCorpo("<SCRIPT>alert(1)</SCRIPT><p>ok</p><script>sem fim"), "<p>ok</p>");
});

test("texto simples do e-mail preserva parágrafos, listas numeradas e quebras", () => {
  const t = htmlParaTexto("<p>Olá,</p><p>linha 1<br>linha 2</p><ol><li>um</li><li>dois</li></ol><ul><li>item</li></ul><p>&quot;fim&quot; &amp; tchau</p>");
  assert.equal(t, "Olá,\n\nlinha 1\nlinha 2\n\n1. um\n2. dois\n\n- item\n\n\"fim\" & tchau");
});

// ================================================================== modelo HTML
test("modelo do e-mail: cabeçalho institucional, corpo editado com formatação, assinatura escapada", () => {
  const { html, texto } = montarEmailComunicado({ assunto: ASSUNTO_PADRAO, corpo: sanitizarCorpo(CORPO), assinante: "Ana <Souza>" });
  assert.match(html, /JTD TRANSPORTES/);
  assert.match(html, /Comunicação de reajuste contratual/);
  assert.match(html, /<strong style="[^"]+">8,5%<\/strong>/);
  assert.match(html, /<ul style="[^"]+"><li style="[^"]+">Item um<\/li><\/ul>/);
  assert.match(html, /Ana &lt;Souza&gt;/);
  assert.match(html, /<!--\[if mso\]>/);                     // wrapper de largura fixa para o Outlook
  assert.doesNotMatch(html, /E-MAIL DE TESTE/);
  assert.match(texto, /Propomos o reajuste de 8,5%\./);
  assert.match(texto, /- Item um/);
  const teste = montarEmailComunicado({ assunto: "[TESTE] x", corpo: "<p>abc</p>", teste: { destino: "eu@exemplo.com" } });
  assert.match(teste.html, /E-MAIL DE TESTE/);
  assert.match(teste.texto, /E-MAIL DE TESTE/);
});

// ================================================================== anexos
test("anexos: aceita PDF, XLSX e imagens; recusa formatos perigosos, conteúdo falso, macro, excesso e nomes duplicados", () => {
  const ok = svc.validarAnexos([pdf(), xlsx(), png(), { originalname: "foto.JPG", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]) }]);
  assert.deepEqual(ok.map((a) => [a.meta.nome, a.meta.tipo]), [
    ["proposta.pdf", "application/pdf"], ["tabela.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], ["grafico.png", "image/png"], ["foto.jpg", "image/jpeg"],
  ]);
  assert.match(ok[0].meta.sha256, /^[0-9a-f]{64}$/);
  const erro = (arqs, re) => assert.throws(() => svc.validarAnexos(arqs), (e) => re.test(e.message));
  erro([{ originalname: "virus.exe", buffer: Buffer.from("MZ") }], /Formato não permitido/);
  erro([{ originalname: "proposta.pdf.exe", buffer: Buffer.from("%PDF-") }], /Formato não permitido/);
  erro([{ originalname: "fake.pdf", buffer: Buffer.from("MZ executável") }], /não corresponde/);
  erro([xlsx("macro.xlsx", true)], /não corresponde/);
  erro([{ originalname: "vazio.pdf", buffer: Buffer.alloc(0) }], /vazio/);
  erro([{ originalname: "grande.pdf", buffer: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(svc.LIMITES.max_bytes_arquivo)]) }], /no máximo|passa de/);
  erro(Array.from({ length: 11 }, (_, i) => pdf(`p${i}.pdf`)), /no máximo 10/);
  erro([pdf("a.pdf"), pdf("A.pdf")], /dois anexos/);
  assert.equal(svc.nomeSeguro("../../etc/passwd.pdf"), "passwd.pdf");
  assert.equal(svc.nomeSeguro("C:\\temp\\pro<po>sta.pdf"), "pro_po_sta.pdf");
});

// ================================================================== clientes
test("cadastro de clientes: valida e-mails, remove cópia repetida, impede nome duplicado e registra auditoria", async (t) => {
  const db = repoEmMemoria(t);
  await assert.rejects(svc.criarCliente({ ...CLIENTE, email_principal: "invalido@" }, 7), /e-mail inválido/);
  await assert.rejects(svc.criarCliente({ ...CLIENTE, email_principal: "" }, 7), /e-mail inválido/);
  await assert.rejects(svc.criarCliente({ ...CLIENTE, emails_cc: "ok@a.com; errado" }, 7), /e-mail inválido/);
  await assert.rejects(svc.criarCliente({ ...CLIENTE, nome: "" }, 7), /nome do cliente/);
  const { cliente } = await svc.criarCliente({ ...CLIENTE, email_principal: " Compras@ALFA.com.br ", emails_cc: "financeiro@alfa.com.br;\ncompras@alfa.com.br, financeiro@alfa.com.br" }, 7);
  assert.equal(cliente.email_principal, "compras@alfa.com.br");
  assert.deepEqual(cliente.emails_cc, ["financeiro@alfa.com.br"]);
  await assert.rejects(svc.criarCliente({ ...CLIENTE, nome: "cliente alfa ltda" }, 7), (e) => e.status === 409);
  assert.equal(db.auditoria.filter((a) => a.acao === "COMUNICADO_CLIENTE_CRIADO").length, 1);
});

test("edição, pesquisa e exclusão lógica do cliente; histórico preservado", async (t) => {
  const { db, cliente } = await comCliente(t);
  resendSimulado(t);
  await svc.enviar(mensagem(cliente), [], 7, null);
  const { cliente: editado } = await svc.atualizarCliente(cliente.id, { ...CLIENTE, email_principal: "novo@alfa.com.br", ativo: false }, 7);
  assert.equal(editado.email_principal, "novo@alfa.com.br");
  assert.equal(editado.ativo, false);
  assert.equal((await svc.listarClientes({ busca: "alfa" })).clientes.length, 1);
  assert.equal((await svc.listarClientes({ ativos: "1" })).clientes.length, 0);         // inativo não aparece para envio
  await svc.excluirCliente(cliente.id, 7);
  assert.equal((await svc.listarClientes({})).clientes.length, 0);
  await assert.rejects(svc.atualizarCliente(cliente.id, CLIENTE, 7), (e) => e.status === 404);
  // o comunicado antigo continua intacto, com o e-mail usado na época
  const { comunicado } = await svc.obterComunicado(1);
  assert.equal(comunicado.destinatario, "compras@alfa.com.br");
  assert.equal(comunicado.cliente_nome, "Cliente Alfa Ltda");
  // recadastrar o mesmo nome reaproveita o registro excluído (sem duplicar antt_clientes)
  const r = await svc.criarCliente(CLIENTE, 7);
  assert.equal(r.reaproveitado, true);
  assert.equal(r.cliente.id, cliente.id);
  assert.ok(db.auditoria.some((a) => a.acao === "COMUNICADO_CLIENTE_EXCLUIDO"));
});

// ================================================================== pré-visualização = envio
test("pré-visualização usa o mesmo HTML do envio real e mostra remetente, destinatário, cópias e anexos", async (t) => {
  process.env.ANTT_COMUNICADOS_REPLY_TO = "comercial@jtdtransportes.com.br";
  t.after(() => { delete process.env.ANTT_COMUNICADOS_REPLY_TO; });
  const { cliente } = await comCliente(t);
  const chamadas = resendSimulado(t);
  const msg = mensagem(cliente, { anexos: [{ nome: "proposta.pdf", tamanho: 25 }] });
  const { email, anexos } = await svc.visualizar(msg, 7);
  assert.equal(email.para, "compras@alfa.com.br");
  assert.deepEqual(email.cc, ["financeiro@alfa.com.br"]);
  assert.equal(email.reply_to, "comercial@jtdtransportes.com.br");
  assert.match(email.de, /^Evandro Meato JTD Transportes <[^>]+@[^>]+>$/);
  assert.match(email.html, /Evandro Meato<\/strong><br><span[^>]*>JTD Transportes/);   // assinatura = remetente
  assert.equal(email.assunto, ASSUNTO_PADRAO);
  assert.deepEqual(anexos, [{ nome: "proposta.pdf", tamanho: 25 }]);
  assert.equal(chamadas.length, 0);                                                    // prévia nunca envia
  await svc.enviar(msg, [pdf()], 7, null);
  assert.equal(chamadas[0].html, email.html);
  assert.equal(chamadas[0].text, email.texto);
});

test("remetente: 'Evandro Meato JTD Transportes' com o endereço verificado, nunca o nome 'Site JTD Transportes'", (t) => {
  const antes = { ...process.env };
  t.after(() => { for (const k of ["MAIL_FROM_EMAIL", "MAIL_FROM_NAME", "ANTT_COMUNICADOS_FROM", "ANTT_COMUNICADOS_FROM_NAME"]) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; } });
  delete process.env.ANTT_COMUNICADOS_FROM; delete process.env.ANTT_COMUNICADOS_FROM_NAME;
  process.env.MAIL_FROM_EMAIL = "Site JTD Transportes <site@jtdtransportes.com.br>";
  assert.equal(svc.remetenteComunicados(), "Evandro Meato JTD Transportes <site@jtdtransportes.com.br>");
  process.env.MAIL_FROM_EMAIL = "site@jtdtransportes.com.br"; process.env.MAIL_FROM_NAME = "Site JTD Transportes";
  assert.equal(svc.remetenteComunicados(), "Evandro Meato JTD Transportes <site@jtdtransportes.com.br>");
  process.env.ANTT_COMUNICADOS_FROM = "comercial@jtdtransportes.com.br"; process.env.ANTT_COMUNICADOS_FROM_NAME = "Outro Nome";
  assert.equal(svc.remetenteComunicados(), "Outro Nome <comercial@jtdtransportes.com.br>");
});

test("acumulado do mês (NE/NO): usa o marco em vigor; se o mês virou marco zero, compara com o marco anterior", () => {
  const marcoJan = { ano: 2026, mes: 1, preco: "6.100000" };
  // out/2026 ainda sob o marco de jan: +3,00%
  const serie = [
    { ano: 2026, mes: 9, preco_medio: "6.200000", mes_completo: true, marco_ref: marcoJan, marco_inicia_aqui: false },
    { ano: 2026, mes: 10, preco_medio: "6.283000", mes_completo: false, marco_ref: marcoJan, marco_inicia_aqui: false },
  ];
  assert.deepEqual(svc.acumuladoDoMes(serie), { pct: "3.00", ano: 2026, mes: 10, mes_parcial: true, marco: { ano: 2026, mes: 1 } });
  // nov/2026 atingiu o gatilho e virou o novo marco zero: o acumulado é contra jan (5,29%), não 0%
  serie.push({ ano: 2026, mes: 11, preco_medio: "6.422690", mes_completo: true, marco_ref: { ano: 2026, mes: 11, preco: "6.422690" }, marco_inicia_aqui: true });
  assert.deepEqual(svc.acumuladoDoMes(serie), { pct: "5.29", ano: 2026, mes: 11, mes_parcial: false, marco: { ano: 2026, mes: 1 } });
  assert.equal(svc.acumuladoDoMes([]), null);
  assert.equal(svc.acumuladoDoMes([{ ano: 2026, mes: 1, preco_medio: "6.1", marco_ref: marcoJan, marco_inicia_aqui: true }]), null);   // só o marco inicial
});

// ================================================================== modo de teste
test("envio de teste: só para o e-mail do próprio usuário, sem cópias, com [TESTE], mesmo corpo e anexos", async (t) => {
  const { db, cliente } = await comCliente(t);
  const chamadas = resendSimulado(t);
  const r = await svc.enviar(mensagem(cliente, { confirmar: undefined, chave_envio: undefined, destinatario_esperado: "outro@x.com" }), [pdf(), xlsx()], 7, null, { teste: true });
  assert.equal(r.modo, "TESTE");
  assert.deepEqual(chamadas[0].to, [USUARIO.email]);
  assert.deepEqual(chamadas[0].cc, []);
  assert.equal(chamadas[0].subject, `[TESTE] ${ASSUNTO_PADRAO}`);
  assert.doesNotMatch(JSON.stringify(chamadas[0]), /alfa\.com\.br/);                   // o cliente nunca aparece como destino
  assert.deepEqual(chamadas[0].attachments.map((a) => a.filename), ["proposta.pdf", "tabela.xlsx"]);
  const real = montarEmailComunicado({ assunto: "x", corpo: sanitizarCorpo(CORPO), assinante: svc.assinaturaComunicados() }).html;
  const corpoDe = (h) => h.slice(h.indexOf("JTD TRANSPORTES"));
  assert.equal(corpoDe(chamadas[0].html), corpoDe(real));                               // mesmo cartão/corpo do real
  assert.equal(db.comunicados[0].modo, "TESTE");
  assert.equal(db.comunicados[0].status, "ENVIADO");
  assert.ok(db.auditoria.some((a) => a.acao === "COMUNICADO_TESTE_ENVIADO"));
});

test("teste também funciona sem cliente selecionado e respeita o limite de frequência", async (t) => {
  repoEmMemoria(t);
  resendSimulado(t);
  for (let i = 0; i < 10; i++) await svc.enviar({ assunto: ASSUNTO_PADRAO, corpo_html: CORPO }, [], 7, null, { teste: true });
  await assert.rejects(svc.enviar({ assunto: ASSUNTO_PADRAO, corpo_html: CORPO }, [], 7, null, { teste: true }), (e) => e.status === 429);
});

// ================================================================== envio real
test("envio real: exige confirmação explícita, chave de envio e destinatário revisado", async (t) => {
  const { cliente } = await comCliente(t);
  const chamadas = resendSimulado(t);
  await assert.rejects(svc.enviar(mensagem(cliente, { confirmar: false }), [], 7, null), /Confirme o envio/);
  await assert.rejects(svc.enviar(mensagem(cliente, { confirmar: undefined }), [], 7, null), /Confirme o envio/);
  await assert.rejects(svc.enviar(mensagem(cliente, { chave_envio: undefined }), [], 7, null), /Chave de envio/);
  await assert.rejects(svc.enviar(mensagem(cliente, { destinatario_esperado: "antigo@alfa.com.br" }), [], 7, null), (e) => e.status === 409);
  await assert.rejects(svc.enviar(mensagem(null), [], 7, null), /Selecione o cliente/);
  await assert.rejects(svc.enviar(mensagem(cliente, { corpo_html: "<p> </p><script>x</script>" }), [], 7, null), /vazia/);
  assert.equal(chamadas.length, 0);
});

test("envio real: cliente, cópias, reply-to e anexos pelo Resend; histórico completo e imutável", async (t) => {
  process.env.ANTT_COMUNICADOS_REPLY_TO = "comercial@jtdtransportes.com.br";
  t.after(() => { delete process.env.ANTT_COMUNICADOS_REPLY_TO; });
  const { db, cliente } = await comCliente(t);
  const chamadas = resendSimulado(t, [{ id: "re_abc123", error: null }]);
  const r = await svc.enviar(mensagem(cliente, { corpo_html: `${CORPO}<img src=x onerror=alert(1)>` }), [pdf()], 7, "10.0.0.1");
  assert.equal(r.provedor_id, "re_abc123");
  const env = chamadas[0];
  assert.deepEqual(env.to, ["compras@alfa.com.br"]);
  assert.deepEqual(env.cc, ["financeiro@alfa.com.br"]);
  assert.equal(env.replyTo, "comercial@jtdtransportes.com.br");
  assert.equal(env.subject, ASSUNTO_PADRAO);
  assert.equal(env.idempotencyKey, "antt-comunicado-1");
  assert.ok(Buffer.isBuffer(env.attachments[0].content));
  assert.doesNotMatch(env.html, /onerror/);
  const c = db.comunicados[0];
  assert.deepEqual([c.modo, c.status, c.provedor_id, c.cliente_nome, c.enviado_por, c.enviado_por_nome], ["REAL", "ENVIADO", "re_abc123", "Cliente Alfa Ltda", 7, "Ana Souza"]);
  assert.deepEqual([c.percentual, c.data_vigencia, c.contrato_ref], ["8.5", "2026-12-01", "CT-2024/015"]);
  assert.equal(c.anexos[0].nome, "proposta.pdf");
  assert.equal(c.email_html, env.html);
  assert.ok(!("buffer" in c.anexos[0]) && !("content" in c.anexos[0]));              // só metadados no banco
  // o histórico guarda a "foto": mudar o cadastro depois não altera o comunicado
  await svc.atualizarCliente(cliente.id, { ...CLIENTE, nome: "Alfa Renomeada", email_principal: "outro@alfa.com.br" }, 7);
  assert.equal((await svc.obterComunicado(1)).comunicado.destinatario, "compras@alfa.com.br");
});

test("duplicidade: clique repetido (mesma chave) e envio idêntico recente não geram segundo e-mail", async (t) => {
  const { cliente } = await comCliente(t);
  const chamadas = resendSimulado(t);
  const msg = mensagem(cliente);
  await svc.enviar(msg, [], 7, null);
  await assert.rejects(svc.enviar(msg, [], 7, null), (e) => e.status === 409 && /acabou de ser enviado|já foi registrado/.test(e.message));
  await assert.rejects(svc.enviar({ ...msg, chave_envio: crypto.randomUUID() }, [], 7, null), (e) => e.status === 409);
  // cliques simultâneos com a mesma chave: só um passa
  const outra = mensagem(cliente, { assunto: "Outro assunto", chave_envio: crypto.randomUUID() });
  const res = await Promise.allSettled([svc.enviar(outra, [], 7, null), svc.enviar(outra, [], 7, null)]);
  assert.equal(res.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(chamadas.length, 2);
});

test("falha do Resend fica registrada como FALHA (sem vazar a chave) e permite novo envio", async (t) => {
  const { db, cliente } = await comCliente(t);
  const chamadas = resendSimulado(t, [{ id: null, error: { message: "API key re_SEGREDO123456 inválida", statusCode: 401, name: "validation_error" } }]);
  await assert.rejects(svc.enviar(mensagem(cliente), [], 7, null), (e) => e.status === 502 && !/SEGREDO/.test(e.message));
  assert.equal(db.comunicados[0].status, "FALHA");
  assert.doesNotMatch(db.comunicados[0].erro, /SEGREDO/);
  await svc.enviar(mensagem(cliente), [], 7, null);                                    // falha não bloqueia o reenvio
  assert.equal(chamadas.length, 2);
});

test("webhook do Resend atualiza o status do comunicado (entregue / devolvido)", async (t) => {
  const { db, cliente } = await comCliente(t);
  resendSimulado(t, [{ id: "re_wh1", error: null }]);
  t.mock.method(anttRepo, "atualizarNotificacaoPorProvedor", async () => false);      // não é alerta automático
  await svc.enviar(mensagem(cliente), [], 7, null);
  const segredo = `whsec_${Buffer.from("segredo-de-teste-123").toString("base64")}`;
  process.env.RESEND_WEBHOOK_SECRET = segredo;
  t.after(() => { delete process.env.RESEND_WEBHOOK_SECRET; });
  const corpo = JSON.stringify({ type: "email.delivered", data: { email_id: "re_wh1" } });
  const id = "msg_1"; const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac("sha256", Buffer.from(segredo.slice(6), "base64")).update(`${id}.${ts}.${corpo}`).digest("base64");
  const res = { status(c) { this.code = c; return this; }, json() { return this; } };
  await webhookResend({ body: Buffer.from(corpo), get: (h) => ({ "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}` })[h] }, res);
  assert.equal(res.code, undefined);                                                   // res.json sem status = 200
  assert.equal(db.comunicados[0].status, "ENTREGUE");
});

test("histórico: filtros validados e consulta do comunicado exato", async (t) => {
  const { cliente } = await comCliente(t);
  resendSimulado(t);
  await svc.enviar(mensagem(cliente), [], 7, null);
  await svc.enviar(mensagem(cliente), [], 7, null, { teste: true }).catch(() => {});
  assert.equal((await svc.historico({ cliente_id: String(cliente.id), modo: "REAL" })).comunicados.length, 1);
  await assert.rejects(svc.historico({ de: "2026-12-10", ate: "2026-12-01" }), /posterior/);
  await assert.rejects(svc.historico({ de: "2026-02-31" }), /inexistente/);
  await assert.rejects(svc.obterComunicado("abc"), (e) => e.status === 404);
});

// ================================================================== permissões
function acessoMock(t, usuario, autorizados = [], comunicados = []) {
  t.mock.method(anttRepo, "getUsuarioAcesso", async () => usuario);
  t.mock.method(anttRepo, "getConfigRows", async () => ({ setores_autorizados: JSON.stringify(autorizados), setores_comunicados: JSON.stringify(comunicados) }));
}

test("permissões: admin sempre; setor só comunica se tiver acesso ao módulo E estiver marcado para comunicados", async (t) => {
  acessoMock(t, { id: 1, role: "admin", sector_id: 1, is_active: 1 });
  assert.equal((await verificarAcesso(1)).pode_comunicar, true);
  t.mock.restoreAll();
  acessoMock(t, { id: 2, role: "user", sector_id: 3, is_active: 1 }, [3], []);
  assert.equal((await verificarAcesso(2)).pode_comunicar, false);
  t.mock.restoreAll();
  acessoMock(t, { id: 2, role: "user", sector_id: 3, is_active: 1 }, [3], [3]);
  assert.equal((await verificarAcesso(2)).pode_comunicar, true);
  t.mock.restoreAll();
  acessoMock(t, { id: 2, role: "user", sector_id: 3, is_active: 1 }, [], [3]);          // sem acesso ao módulo
  const r = await verificarAcesso(2);
  assert.equal(r.acesso, false); assert.equal(r.pode_comunicar, false);
  const resp = { status(c) { this.code = c; return this; }, json() { return this; } };
  let passou = false;
  anttComunicar({ anttAcesso: { acesso: true, pode_comunicar: false } }, resp, () => { passou = true; });
  assert.equal(resp.code, 403); assert.equal(passou, false);
});

test("rotas HTTP: exigem login e permissão; não existe rota para alterar ou apagar comunicado", async (t) => {
  process.env.JWT_SECRET ||= "segredo-somente-teste";
  const { default: anttRoutes } = await import("../routes/antt.routes.js");
  repoEmMemoria(t);
  const chamadas = resendSimulado(t);
  const usuarios = { 7: { id: 7, role: "admin", sector_id: 1, is_active: 1 }, 2: { id: 2, role: "user", sector_id: 3, is_active: 1 } };
  t.mock.method(anttRepo, "getUsuarioAcesso", async (id) => usuarios[id]);
  t.mock.method(anttRepo, "getConfigRows", async () => ({ setores_autorizados: "[3]", setores_comunicados: "[]" }));
  const app = express();
  app.use(express.json());
  app.use("/api/antt", anttRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/antt/comunicados`;
  const tok = (id) => ({ Authorization: `Bearer ${jwt.sign({ id, role: usuarios[id].role }, process.env.JWT_SECRET)}` });
  const req = (p, opt = {}) => fetch(base + p, { signal: AbortSignal.timeout(5000), ...opt });

  assert.equal((await req("/clientes")).status, 401);
  assert.equal((await req("/clientes", { headers: tok(2) })).status, 403);              // leitor sem permissão de comunicados
  const form = new FormData();
  form.append("dados", JSON.stringify({ assunto: ASSUNTO_PADRAO, corpo_html: CORPO }));
  assert.equal((await req("/teste", { method: "POST", headers: tok(2), body: form })).status, 403);
  assert.equal(chamadas.length, 0);

  const criar = await req("/clientes", { method: "POST", headers: { ...tok(7), "Content-Type": "application/json" }, body: JSON.stringify(CLIENTE) });
  assert.equal(criar.status, 200);
  const form2 = new FormData();
  form2.append("dados", JSON.stringify({ assunto: ASSUNTO_PADRAO, corpo_html: CORPO }));
  form2.append("anexos", new Blob([pdf().buffer], { type: "application/pdf" }), "proposta.pdf");
  const teste = await req("/teste", { method: "POST", headers: tok(7), body: form2 });
  assert.equal(teste.status, 200, await teste.clone().text());
  assert.equal(chamadas[0].attachments[0].filename, "proposta.pdf");
  const form3 = new FormData();
  form3.append("dados", JSON.stringify({ assunto: ASSUNTO_PADRAO, corpo_html: CORPO }));
  form3.append("anexos", new Blob(["MZ"]), "programa.exe");
  assert.equal((await req("/teste", { method: "POST", headers: tok(7), body: form3 })).status, 400);
  assert.equal((await req("/historico/1", { method: "PUT", headers: tok(7) })).status, 404);
  assert.equal((await req("/historico/1", { method: "DELETE", headers: tok(7) })).status, 404);
});
