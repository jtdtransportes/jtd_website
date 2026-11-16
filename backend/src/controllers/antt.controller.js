import * as svc from "../services/antt.service.js";
import { updateConfig } from "../antt/config.js";
import { sincronizarAnp, importarArquivoManual } from "../antt/anpSync.js";
import { recalcularIndicadores } from "../antt/triggers.js";
import { enviarEmailTeste, obterNotificacoes, salvarConfigNotificacoes } from "../antt/notificacoes.js";

const ip = (req) => req.ip || req.socket?.remoteAddress || null;

// Envolve o handler: respostas { ok: true, ...dados } e erros tratados sem vazar detalhes internos.
const h = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (data === undefined) return undefined; // handler já respondeu (download)
    return res.json({ ok: true, ...data });
  } catch (e) {
    const status = e.status && e.status < 500 ? e.status : 500;
    if (status === 500) console.error("[ANTT]", e);
    return res.status(status).json({ ok: false, message: status === 500 ? "Erro interno no módulo ANTT." : e.message });
  }
};

const arquivo = (req) => {
  if (!req.file) {
    const e = new Error('Envie um arquivo (campo "arquivo").');
    e.status = 400;
    throw e;
  }
  return req.file;
};

export default {
  acesso: h(async (req) => svc.verificarAcesso(req.user.id)),
  config: h(async () => ({ config: await svc.configuracaoPublica() })),
  salvarConfig: h(async (req) => {
    await updateConfig(req.body, req.user.id, ip(req));
    // O limite do gatilho muda a cadeia de marcos zero automáticos: recalcula na hora.
    if (req.body?.limite_gatilho_pct != null) await recalcularIndicadores();
    return { config: await svc.configuracaoPublica() };
  }),
  opcoes: h(async () => svc.opcoes()),
  dashboard: h(async (req) => svc.dashboard(req.query)),
  historicoSemanal: h(async (req) => svc.historicoSemanal(req.query)),
  historicoMensal: h(async (req) => svc.historicoMensal(req.query)),
  statusSync: h(async () => svc.statusSync()),
  versao: h(async () => svc.versaoDados()),
  notificacoes: h(async () => obterNotificacoes()),
  salvarNotificacoes: h(async (req) => salvarConfigNotificacoes(req.body, req.user.id, ip(req))),
  testarEmail: h(async (req) => enviarEmailTeste(req.user.id)),
  sincronizar: h(async (req) => sincronizarAnp({ origem: "MANUAL", usuarioId: req.user.id, completo: req.query.completo === "1" })),
  importarAnp: h(async (req) =>
    importarArquivoManual({ buffer: arquivo(req).buffer, nome: req.file.originalname, usuarioId: req.user.id })
  ),
  marcos: h(async (req) => svc.listarMarcos(req.query)),
  criarMarco: h(async (req) => svc.criarMarco(req.body, req.user.id, ip(req))),
  reajustes: h(async () => svc.listarReajustes()),
  decidirReajuste: h(async (req) => svc.registrarDecisaoReajuste(req.body, req.user.id, ip(req))),
  gatilhos: h(async (req) => svc.listarGatilhos(req.query)),
  alertas: h(async (req) => svc.listarAlertas(req.query)),
  resolverAlerta: h(async (req) => svc.resolverAlerta(req.params.id, req.user.id, ip(req))),
  tabelasFrete: h(async () => svc.listarTabelasFrete()),
  criarTabelaFrete: h(async (req) => svc.criarTabelaFrete(req.body, req.user.id, ip(req))),
  calculadora: h(async (req) => ({ resultado: await svc.calculadora(req.body) })),
  clientes: h(async () => svc.listarClientes()),
  criarCliente: h(async (req) => svc.criarCliente(req.body, req.user.id, ip(req))),
  contratos: h(async (req) => svc.listarContratos(req.query)),
  criarContrato: h(async (req) => svc.criarContrato(req.body, req.user.id, ip(req))),
  atualizarContrato: h(async (req) => svc.atualizarContrato(req.params.id, req.body, req.user.id, ip(req))),
  fretes: h(async (req) => svc.listarFretes(req.query)),
  criarFrete: h(async (req) => svc.criarFrete(req.body, req.user.id, ip(req))),
  importarFretes: h(async (req) =>
    svc.importarFretes(
      { buffer: arquivo(req).buffer, nome: req.file.originalname, clienteId: req.body.cliente_id, contratoId: req.body.contrato_id },
      req.user.id,
      ip(req)
    )
  ),
  calcularRetroativos: h(async (req) => ({ resultado: await svc.calcularRetroativos(req.body, req.user.id, ip(req)) })),
  retroativos: h(async () => svc.listarRetroativos()),
  retroativo: h(async (req) => ({ retroativo: await svc.obterRetroativo(req.params.id) })),
  exportarRetroativo: h(async (req, res) => {
    const { buffer, nome } = await svc.exportarRetroativoXlsx(req.params.id, req.user.id, ip(req));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${nome}"`);
    res.send(buffer);
    return undefined;
  }),
  auditoria: h(async () => svc.listarAuditoria()),
};
