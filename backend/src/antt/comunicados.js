// "Comunicar reajuste": envio MANUAL de e-mails de reajuste contratual a clientes cadastrados.
// Independente dos gatilhos automáticos (nada aqui é chamado pela sincronização da ANP) e nunca envia sem um
// pedido explícito do funcionário: o envio real exige confirmar === true + chave de envio única.
//
// Reaproveita: mailer/remetente/erroSeguro (notificacoes.js → Resend), auditoria do módulo e antt_clientes.
// Destinatários SEMPRE vêm do banco (cadastro do cliente ou e-mail do próprio usuário no teste), nunca do navegador.
import crypto from "crypto";
import path from "path";
import { z } from "zod";
import repo from "../repositories/anttComunicados.repository.js";
import anttRepo from "../repositories/antt.repository.js";
import { mailer, remetente, erroSeguro } from "./notificacoes.js";
import { ASSUNTO_PADRAO, montarEmailComunicado } from "./emailComunicado.js";
import { htmlParaTexto, sanitizarCorpo, LIMITE_CORPO } from "./htmlSeguro.js";
import { fixMojibake } from "../utils/textEncoding.js";
import { carregarIndicadores } from "./triggers.js";
import * as D from "./decimal.js";

const erroHttp = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

// Resend: até 40 MB por e-mail DEPOIS da codificação base64 (+33%). 25 MB brutos ≈ 33 MB codificados, com folga.
export const LIMITES = {
  max_arquivos: 10,
  max_bytes_arquivo: 10 * 1024 * 1024,
  max_bytes_total: 25 * 1024 * 1024,
  extensoes: [".pdf", ".xlsx", ".png", ".jpg", ".jpeg"],
  max_cc: 10,
};
const JANELA_DUPLICIDADE_MIN = 2;
const TESTES_POR_JANELA = { max: 10, minutos: 10 };

// ------------------------------------------------------------------ anexos (extensão + assinatura do arquivo)
const comeca = (b, bytes) => bytes.every((x, i) => b[i] === x);
const TIPOS = {
  ".pdf": { mime: "application/pdf", ok: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  ".xlsx": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // ZIP do Office com pasta xl/; recusa planilha com macro (vbaProject.bin) disfarçada de .xlsx
    ok: (b) => comeca(b, [0x50, 0x4b, 0x03, 0x04]) && b.includes("[Content_Types].xml") && b.includes("xl/") && !b.includes("vbaProject.bin"),
  },
  ".png": { mime: "image/png", ok: (b) => comeca(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  ".jpg": { mime: "image/jpeg", ok: (b) => comeca(b, [0xff, 0xd8, 0xff]) },
  ".jpeg": { mime: "image/jpeg", ok: (b) => comeca(b, [0xff, 0xd8, 0xff]) },
};

export function nomeSeguro(original) {
  const base = path.basename(String(fixMojibake(original || "")).replace(/\\/g, "/"));
  const limpo = base.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "_").replace(/\s+/g, " ").trim();
  const ext = path.extname(limpo).toLowerCase();
  const nome = limpo.slice(0, limpo.length - ext.length).slice(0, 110).replace(/^[.\s]+/, "");
  return nome ? `${nome}${ext}` : "";
}

/** Valida os arquivos recebidos (multer, memória). Retorna anexos para o Resend + metadados para o histórico. */
export function validarAnexos(arquivos = []) {
  if (arquivos.length > LIMITES.max_arquivos) throw erroHttp(400, `Envie no máximo ${LIMITES.max_arquivos} anexos.`);
  let total = 0;
  const nomes = new Set();
  return arquivos.map((f) => {
    const nome = nomeSeguro(f.originalname);
    const ext = path.extname(nome).toLowerCase();
    const tipo = TIPOS[ext];
    if (!nome || !tipo) throw erroHttp(400, `Formato não permitido: ${nome || "arquivo sem nome"}. Aceitos: PDF, Excel (.xlsx), PNG e JPG.`);
    const buf = f.buffer;
    if (!buf?.length) throw erroHttp(400, `O arquivo ${nome} está vazio.`);
    if (buf.length > LIMITES.max_bytes_arquivo) throw erroHttp(413, `O arquivo ${nome} passa de ${LIMITES.max_bytes_arquivo / 1048576} MB.`);
    if (!tipo.ok(buf)) throw erroHttp(400, `O conteúdo de ${nome} não corresponde a um arquivo ${ext.slice(1).toUpperCase()} válido.`);
    total += buf.length;
    if (total > LIMITES.max_bytes_total) throw erroHttp(413, `Os anexos somam mais de ${LIMITES.max_bytes_total / 1048576} MB.`);
    if (nomes.has(nome.toLowerCase())) throw erroHttp(400, `Há dois anexos com o nome ${nome}.`);
    nomes.add(nome.toLowerCase());
    return {
      resend: { filename: nome, content: buf, contentType: tipo.mime },
      meta: { nome, tamanho: buf.length, tipo: tipo.mime, sha256: crypto.createHash("sha256").update(buf).digest("hex") },
    };
  });
}

// ------------------------------------------------------------------ validação
const email = z.string().trim().toLowerCase().max(254).email("e-mail inválido")
  .refine((e) => !/[\s,;<>()"]/.test(e), "e-mail inválido");
const opcional = (s) => z.preprocess((v) => (v === "" || v === null ? undefined : v), s.optional());
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD").refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "data inexistente");
const percentual = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const s = String(v).trim().replace("%", "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(s) || Number(s) <= 0 || Number(s) > 100) {
    ctx.addIssue({ code: "custom", message: "informe um percentual entre 0,01 e 100" });
    return z.NEVER;
  }
  return s;
});

function validar(schema, dados) {
  const r = schema.safeParse(dados ?? {});
  if (!r.success) {
    const i = r.error.issues[0];
    throw erroHttp(400, `Dados inválidos${i?.path?.length ? ` (${i.path.join(".")})` : ""}: ${i?.message || "verifique os campos"}`);
  }
  return r.data;
}

/** Separa por vírgula, ponto e vírgula ou quebra de linha; aceita array. */
const listaEmails = z.preprocess((v) => {
  const arr = Array.isArray(v) ? v : String(v ?? "").split(/[,;\n]+/);
  return arr.map((x) => String(x).trim()).filter(Boolean);
}, z.array(email).max(LIMITES.max_cc, `no máximo ${LIMITES.max_cc} e-mails em cópia`));

const clienteSchema = z.object({
  nome: z.string().trim().min(2, "informe o nome do cliente").max(160),
  email_principal: email,
  contato_nome: opcional(z.string().trim().max(160)),
  emails_cc: listaEmails.default([]),
  observacoes: opcional(z.string().trim().max(1000)),
  ativo: z.boolean().default(true),
});

const mensagemSchema = z.object({
  cliente_id: opcional(z.coerce.number().int().positive()),
  assunto: z.string().transform((s) => s.replace(/[\r\n\t]+/g, " ").trim()).pipe(z.string().min(3, "informe o assunto").max(200)),
  corpo_html: z.string().min(1, "escreva a mensagem").max(LIMITE_CORPO, "mensagem muito longa"),
  percentual: opcional(percentual),
  data_vigencia: opcional(dataIso),
  contrato_ref: opcional(z.string().transform((s) => s.replace(/[\r\n\t]+/g, " ").trim()).pipe(z.string().max(120))),
  chave_envio: opcional(z.string().regex(/^[A-Za-z0-9-]{16,64}$/, "chave de envio inválida")),
  destinatario_esperado: opcional(z.string().trim().toLowerCase()),
  confirmar: z.boolean().optional(),
  anexos: z.array(z.object({ nome: z.string().max(200), tamanho: z.coerce.number().int().min(0) })).max(LIMITES.max_arquivos).optional(),
});

// ------------------------------------------------------------------ endereços institucionais
const emailValido = (s) => email.safeParse(s).success;
export const NOME_REMETENTE_PADRAO = "Evandro Meato JTD Transportes";
export const ASSINATURA_PADRAO = "Evandro Meato";

/**
 * Remetente dos comunicados: nome "Evandro Meato JTD Transportes" (ANTT_COMUNICADOS_FROM_NAME) com o endereço
 * verificado no Resend (ANTT_COMUNICADOS_FROM ou MAIL_FROM_EMAIL). O nome "Site JTD Transportes" do site não é usado aqui.
 */
export function remetenteComunicados() {
  const base = (process.env.ANTT_COMUNICADOS_FROM || "").trim() || remetente();
  const endereco = (/<([^>]+)>/.exec(base)?.[1] || base).trim().replace(/^"|"$/g, "");
  const nome = (process.env.ANTT_COMUNICADOS_FROM_NAME || NOME_REMETENTE_PADRAO).trim().replace(/[\r\n"<>]/g, "");
  return nome ? `${nome} <${endereco}>` : endereco;
}
/** Nome na assinatura do e-mail (o mesmo do remetente; quem enviou de fato fica registrado no histórico). */
export const assinaturaComunicados = () => (process.env.ANTT_COMUNICADOS_ASSINATURA || ASSINATURA_PADRAO).trim();

// ------------------------------------------------------------------ acumulado do Diesel S10 (pré-preenchimento)
/**
 * Variação acumulada do mês mais recente do indicador NE/NO (o mesmo dos gatilhos). Se o próprio mês virou o novo
 * marco zero, o acumulado é medido contra o marco ANTERIOR (mesma regra dos alertas) — senão daria 0%.
 * Só sugere o valor: o funcionário pode editar o percentual antes de enviar.
 */
export function acumuladoDoMes(serieNENO = []) {
  const i = serieNENO.length - 1;
  const atual = serieNENO[i];
  if (!atual) return null;
  const ref = atual.marco_inicia_aqui ? serieNENO[i - 1]?.marco_ref : atual.marco_ref;
  if (!ref || ref.preco == null || (ref.ano === atual.ano && ref.mes === atual.mes)) return null;
  return {
    pct: D.round(D.variacaoPct(atual.preco_medio, ref.preco), 2),
    indicador: "NENO",
    ano: atual.ano, mes: atual.mes, mes_parcial: !atual.mes_completo, semanas: atual.n_semanas ?? null,
    preco_mes: String(atual.preco_medio),
    marco: { ano: ref.ano, mes: ref.mes, preco: String(ref.preco) },
  };
}

async function acumuladoAtual() {
  try {
    const { series } = await carregarIndicadores();
    return acumuladoDoMes(series.NENO);
  } catch (e) {
    console.error("[ANTT comunicados] acumulado indisponível:", e.message);
    return null;
  }
}
/** Reply-To corporativo: ANTT_COMUNICADOS_REPLY_TO (ou MAIL_REPLY_TO). Sem ele, respostas vão para o remetente. */
export function replyToComunicados() {
  const r = (process.env.ANTT_COMUNICADOS_REPLY_TO || process.env.MAIL_REPLY_TO || "").trim().toLowerCase();
  return emailValido(r) ? r : null;
}

// ------------------------------------------------------------------ clientes
function dadosCliente(input) {
  const c = validar(clienteSchema, input);
  c.emails_cc = [...new Set(c.emails_cc)].filter((e) => e !== c.email_principal);
  return c;
}

export async function listarClientes(query = {}) {
  const busca = String(query.busca || "").trim().slice(0, 80);
  const somenteAtivos = query.ativos === "1" || query.ativos === true;
  return { clientes: await repo.listarClientes({ busca, incluirInativos: !somenteAtivos }) };
}

export async function criarCliente(input, userId, ip) {
  const c = dadosCliente(input);
  try {
    const { id, reaproveitado } = await repo.criarCliente(c, userId);
    await anttRepo.audit({ usuarioId: userId, acao: "COMUNICADO_CLIENTE_CRIADO", entidade: "antt_clientes", entidadeId: id, depois: { ...c, reaproveitado }, ip });
    return { cliente: await repo.clientePorId(id), reaproveitado };
  } catch (e) {
    if (e.code === "DUPLICADO" || e.code === "ER_DUP_ENTRY") throw erroHttp(409, "Já existe um cliente cadastrado com esse nome.");
    throw e;
  }
}

export async function atualizarCliente(id, input, userId, ip) {
  const cid = Number(id);
  if (!Number.isInteger(cid) || cid <= 0) throw erroHttp(400, "Cliente inválido.");
  const c = dadosCliente(input);
  const antes = await repo.clientePorId(cid);
  if (!antes) throw erroHttp(404, "Cliente não encontrado.");
  try {
    await repo.atualizarCliente(cid, c, userId);
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") throw erroHttp(409, "Já existe um cliente cadastrado com esse nome.");
    throw e;
  }
  await anttRepo.audit({ usuarioId: userId, acao: "COMUNICADO_CLIENTE_ATUALIZADO", entidade: "antt_clientes", entidadeId: cid, antes, depois: c, ip });
  return { cliente: await repo.clientePorId(cid) };
}

export async function excluirCliente(id, userId, ip) {
  const cid = Number(id);
  const antes = Number.isInteger(cid) && cid > 0 ? await repo.clientePorId(cid) : null;
  if (!antes) throw erroHttp(404, "Cliente não encontrado.");
  await repo.excluirCliente(cid, userId);
  await anttRepo.audit({ usuarioId: userId, acao: "COMUNICADO_CLIENTE_EXCLUIDO", entidade: "antt_clientes", entidadeId: cid, antes, ip });
  return { excluido: true };
}

// ------------------------------------------------------------------ montagem (única para prévia e envio)
async function usuarioAtual(userId) {
  const u = await repo.usuario(userId);
  if (!u) throw erroHttp(401, "Usuário não encontrado.");
  return u;
}

async function clienteParaEnvio(id, { obrigatorio }) {
  if (!id) {
    if (obrigatorio) throw erroHttp(400, "Selecione o cliente destinatário.");
    return null;
  }
  const c = await repo.clientePorId(id);
  if (!c) throw erroHttp(404, "Cliente não encontrado (pode ter sido excluído).");
  if (obrigatorio && !c.ativo) throw erroHttp(400, "Este cliente está inativo. Reative o cadastro para enviar.");
  if (obrigatorio && !c.email_principal) throw erroHttp(400, "Este cliente não tem e-mail principal cadastrado.");
  return c;
}

/**
 * Monta o e-mail exatamente como será enviado. modo REAL → destino = cadastro do cliente (+ cópias);
 * modo TESTE → destino = e-mail do próprio usuário logado, sem cópias, "[TESTE]" no assunto.
 */
function montar({ dados, cliente, usuario, teste }) {
  const corpo = sanitizarCorpo(dados.corpo_html);
  if (htmlParaTexto(corpo).replace(/\s+/g, "").length < 10) throw erroHttp(400, "A mensagem está vazia ou muito curta.");
  const para = teste ? usuario.email : cliente?.email_principal || null;
  const cc = teste ? [] : cliente?.emails_cc || [];
  const assunto = `${teste ? "[TESTE] " : ""}${dados.assunto}`;
  const { html, texto } = montarEmailComunicado({ assunto, corpo, assinante: assinaturaComunicados(), teste: teste ? { destino: para } : null });
  return { de: remetenteComunicados(), para, cc, reply_to: replyToComunicados(), assunto, corpo, html, texto };
}

export async function contexto(userId) {
  const [u, acumulado] = await Promise.all([usuarioAtual(userId), acumuladoAtual()]);
  return {
    assunto_padrao: ASSUNTO_PADRAO,
    remetente: remetenteComunicados(),
    reply_to: replyToComunicados(),
    email_teste: u.email || null,
    assinante: assinaturaComunicados(),
    acumulado,
    resend_configurado: Boolean(process.env.RESEND_API_KEY),
    webhook_configurado: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    limites: LIMITES,
  };
}

/** Pré-visualização: o MESMO montar() do envio real (sem anexos binários; a lista vem só para exibição). */
export async function visualizar(input, userId) {
  const dados = validar(mensagemSchema, input);
  const [usuario, cliente] = await Promise.all([usuarioAtual(userId), clienteParaEnvio(dados.cliente_id, { obrigatorio: false })]);
  const e = montar({ dados, cliente, usuario, teste: false });
  return {
    email: { de: e.de, para: e.para, cc: e.cc, reply_to: e.reply_to, assunto: e.assunto, html: e.html, texto: e.texto },
    cliente: cliente ? { id: cliente.id, nome: cliente.nome, ativo: cliente.ativo } : null,
    anexos: (dados.anexos || []).map((a) => ({ nome: nomeSeguro(a.nome), tamanho: a.tamanho })),
  };
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

/** Envio (teste ou real). arquivos = req.files do multer. */
export async function enviar(input, arquivos, userId, ip, { teste = false } = {}) {
  const dados = validar(mensagemSchema, input);
  if (!teste) {
    if (dados.confirmar !== true) throw erroHttp(400, "Confirme o envio antes de enviar ao cliente.");
    if (!dados.chave_envio) throw erroHttp(400, "Chave de envio ausente. Recarregue a página e tente novamente.");
  }
  const anexos = validarAnexos(arquivos || []);
  const [usuario, cliente] = await Promise.all([usuarioAtual(userId), clienteParaEnvio(dados.cliente_id, { obrigatorio: !teste })]);
  if (teste && !usuario.email) throw erroHttp(400, "Seu usuário não tem e-mail cadastrado para receber o teste.");
  if (!teste && dados.destinatario_esperado !== cliente.email_principal) {
    throw erroHttp(409, "O e-mail do cliente foi alterado depois da sua revisão. Revise o destinatário e confirme de novo.");
  }
  const e = montar({ dados, cliente, usuario, teste });
  const hash = sha(JSON.stringify([e.para, e.cc, e.assunto, e.corpo, anexos.map((a) => a.meta.sha256)]));

  if (teste) {
    if (await repo.contarTestesRecentes(userId, TESTES_POR_JANELA.minutos) >= TESTES_POR_JANELA.max) {
      throw erroHttp(429, `Limite de ${TESTES_POR_JANELA.max} e-mails de teste a cada ${TESTES_POR_JANELA.minutos} minutos. Aguarde um pouco.`);
    }
  } else if (await repo.envioRecenteIdentico(hash, JANELA_DUPLICIDADE_MIN)) {
    throw erroHttp(409, "Este mesmo comunicado acabou de ser enviado para este cliente. Confira o histórico antes de reenviar.");
  }

  const registro = {
    chave_envio: teste ? `teste-${crypto.randomUUID()}` : dados.chave_envio,
    modo: teste ? "TESTE" : "REAL",
    cliente_id: cliente?.id ?? null,
    cliente_nome: cliente?.nome || "(sem cliente selecionado)",
    destinatario: e.para, cc: e.cc, remetente: e.de, reply_to: e.reply_to, assunto: e.assunto,
    corpo_html: e.corpo, email_html: e.html, email_texto: e.texto, conteudo_sha256: hash,
    percentual: dados.percentual ?? null, data_vigencia: dados.data_vigencia || null, contrato_ref: dados.contrato_ref || null,
    anexos: anexos.map((a) => a.meta), enviado_por: userId, enviado_por_nome: usuario.nome || null,
  };
  let id;
  try {
    id = await repo.criarComunicado(registro);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") throw erroHttp(409, "Este envio já foi registrado (clique repetido). Confira o histórico.");
    throw err;
  }

  let res;
  try {
    res = await mailer.enviar({
      from: e.de, to: [e.para], cc: e.cc, replyTo: e.reply_to || undefined, subject: e.assunto, html: e.html, text: e.texto,
      attachments: anexos.map((a) => a.resend), idempotencyKey: `antt-comunicado-${id}`,
      tags: [{ name: "modulo", value: "antt" }, { name: "tipo", value: teste ? "comunicado_teste" : "comunicado" }, { name: "comunicado", value: String(id) }],
    });
  } catch (err) {
    res = { id: null, error: { message: err.message } };
  }
  const auditoria = { usuarioId: userId, entidade: "antt_comunicados", entidadeId: id, ip };
  if (res.error) {
    const erro = erroSeguro(res.error);
    await repo.atualizarStatusComunicado(id, { status: "FALHA", erro });
    await anttRepo.audit({ ...auditoria, acao: teste ? "COMUNICADO_TESTE_FALHOU" : "COMUNICADO_FALHOU", depois: { destinatario: e.para, erro } });
    throw erroHttp(502, `O Resend recusou o envio: ${erro}`, { comunicado_id: id });
  }
  await repo.atualizarStatusComunicado(id, { status: "ENVIADO", provedor_id: res.id, enviado: true, erro: null });
  await anttRepo.audit({
    ...auditoria, acao: teste ? "COMUNICADO_TESTE_ENVIADO" : "COMUNICADO_ENVIADO",
    depois: { cliente_id: registro.cliente_id, destinatario: e.para, cc: e.cc, assunto: e.assunto, anexos: registro.anexos.map((a) => a.nome), provedor_id: res.id },
  });
  return { id, modo: registro.modo, provedor_id: res.id, destinatario: e.para, cc: e.cc, assunto: e.assunto };
}

// ------------------------------------------------------------------ histórico (somente leitura)
const filtroSchema = z.object({
  cliente_id: opcional(z.coerce.number().int().positive()),
  de: opcional(dataIso),
  ate: opcional(dataIso),
  modo: opcional(z.enum(["TESTE", "REAL"])),
});

export async function historico(query) {
  const f = validar(filtroSchema, query);
  if (f.de && f.ate && f.de > f.ate) throw erroHttp(400, "A data inicial é posterior à data final.");
  const [comunicados, clientes] = await Promise.all([
    repo.listarComunicados({ clienteId: f.cliente_id, de: f.de, ate: f.ate, modo: f.modo }),
    repo.clientesDoHistorico(),
  ]);
  return { comunicados, clientes };
}

export async function obterComunicado(id) {
  const cid = Number(id);
  const c = Number.isInteger(cid) && cid > 0 ? await repo.obterComunicado(cid) : null;
  if (!c) throw erroHttp(404, "Comunicado não encontrado.");
  return { comunicado: c };
}
