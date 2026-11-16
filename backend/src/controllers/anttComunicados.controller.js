import * as svc from "../antt/comunicados.js";

const ip = (req) => req.ip || req.socket?.remoteAddress || null;

// Mesmo padrão do antt.controller: { ok: true, ...dados } e erros sem detalhes internos.
const h = (fn) => async (req, res) => {
  try {
    return res.json({ ok: true, ...(await fn(req, res)) });
  } catch (e) {
    const status = e.status && e.status < 500 ? e.status : e.status === 502 ? 502 : 500;
    if (status === 500) console.error("[ANTT comunicados]", e);
    return res.status(status).json({ ok: false, message: status === 500 ? "Erro interno no módulo ANTT." : e.message, ...(e.comunicado_id ? { comunicado_id: e.comunicado_id } : {}) });
  }
};

/** Multipart: os campos vêm em "dados" (JSON) e os arquivos em "anexos". */
function dadosMultipart(req) {
  try {
    return typeof req.body?.dados === "string" ? JSON.parse(req.body.dados) : req.body || {};
  } catch {
    throw Object.assign(new Error("Dados do envio inválidos."), { status: 400 });
  }
}

export default {
  contexto: h(async (req) => svc.contexto(req.user.id)),
  clientes: h(async (req) => svc.listarClientes(req.query)),
  criarCliente: h(async (req) => svc.criarCliente(req.body, req.user.id, ip(req))),
  atualizarCliente: h(async (req) => svc.atualizarCliente(req.params.id, req.body, req.user.id, ip(req))),
  excluirCliente: h(async (req) => svc.excluirCliente(req.params.id, req.user.id, ip(req))),
  visualizar: h(async (req) => svc.visualizar(req.body, req.user.id)),
  enviarTeste: h(async (req) => ({ envio: await svc.enviar(dadosMultipart(req), req.files, req.user.id, ip(req), { teste: true }) })),
  enviar: h(async (req) => ({ envio: await svc.enviar(dadosMultipart(req), req.files, req.user.id, ip(req), { teste: false }) })),
  historico: h(async (req) => svc.historico(req.query)),
  comunicado: h(async (req) => svc.obterComunicado(req.params.id)),
};
