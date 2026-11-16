import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { anttLeitura, anttEscrita, anttComunicar } from "../middlewares/antt.middleware.js";
import c from "../controllers/antt.controller.js";
import cc from "../controllers/anttComunicados.controller.js";
import { LIMITES } from "../antt/comunicados.js";
import rateLimit from "express-rate-limit";
import { cronSync } from "../antt/cron.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(csv|xlsx)$/i.test(file.originalname || "");
    cb(ok ? null : Object.assign(new Error("Envie um arquivo .csv ou .xlsx."), { status: 400 }), ok);
  },
});
const enviar = (req, res, next) =>
  upload.single("arquivo")(req, res, (err) => {
    if (!err) return next();
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({ ok: false, message: tooBig ? "Arquivo acima de 60 MB." : err.message });
  });

// Único endpoint sem JWT: disparo agendado externo, protegido por segredo (ANTT_CRON_SECRET).
router.post("/cron/sync", cronSync);

// Toda outra rota exige autenticação (JWT). Quem não tem acesso ao módulo só consegue consultar /acesso.
router.use(authMiddleware);
router.get("/acesso", c.acesso);
router.use(anttLeitura);

// leitura (admin + setores autorizados)
router.get("/config", c.config);
router.get("/opcoes", c.opcoes);
router.get("/dashboard", c.dashboard);
router.get("/historico/semanal", c.historicoSemanal);
router.get("/historico/mensal", c.historicoMensal);
router.get("/sync/status", c.statusSync);
router.get("/sync/versao", c.versao);
router.get("/marcos", c.marcos);
router.get("/reajustes", c.reajustes);
router.get("/gatilhos", c.gatilhos);
router.get("/alertas", c.alertas);
router.get("/tabelas-frete", c.tabelasFrete);
router.post("/calculadora", c.calculadora);
router.get("/clientes", c.clientes);
router.get("/contratos", c.contratos);
router.get("/fretes", c.fretes);
router.get("/retroativos", c.retroativos);
router.get("/retroativos/:id", c.retroativo);
router.get("/retroativos/:id/exportar", c.exportarRetroativo);

// escrita (somente administradores)
router.put("/config", anttEscrita, c.salvarConfig);
router.post("/sync", anttEscrita, c.sincronizar);
router.post("/importar/anp", anttEscrita, enviar, c.importarAnp);
router.post("/marcos", anttEscrita, c.criarMarco);
router.post("/reajustes/decisao", anttEscrita, c.decidirReajuste);
router.patch("/alertas/:id/resolver", anttEscrita, c.resolverAlerta);
// Notificações por e-mail (somente administradores; e-mails cadastrados não são expostos a leitores)
const limiteTesteEmail = rateLimit({ windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, message: "Muitos envios de teste. Aguarde alguns minutos." } });
router.get("/notificacoes", anttEscrita, c.notificacoes);
router.put("/notificacoes/config", anttEscrita, c.salvarNotificacoes);
router.post("/notificacoes/teste", anttEscrita, limiteTesteEmail, c.testarEmail);
router.post("/tabelas-frete", anttEscrita, c.criarTabelaFrete);
router.post("/clientes", anttEscrita, c.criarCliente);
router.post("/contratos", anttEscrita, c.criarContrato);
router.put("/contratos/:id", anttEscrita, c.atualizarContrato);
router.post("/fretes", anttEscrita, c.criarFrete);
router.post("/fretes/importar", anttEscrita, enviar, c.importarFretes);
router.post("/retroativos/calcular", anttEscrita, c.calcularRetroativos);
router.get("/auditoria", anttEscrita, c.auditoria);

// ------------------------------------------------------------------ Comunicar reajuste (envio MANUAL a clientes)
// Administradores + setores autorizados para comunicados. Independente dos gatilhos automáticos.
const anexos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITES.max_bytes_arquivo, files: LIMITES.max_arquivos, fields: 5, fieldSize: 512 * 1024 },
});
const receberAnexos = (req, res, next) =>
  anexos.array("anexos", LIMITES.max_arquivos)(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === "LIMIT_FILE_SIZE" ? `Cada anexo pode ter no máximo ${LIMITES.max_bytes_arquivo / 1048576} MB.`
      : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE" ? `Envie no máximo ${LIMITES.max_arquivos} anexos.` : "Não foi possível ler os anexos.";
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ ok: false, message: msg });
  });
const limite = (max, minutos, message) => rateLimit({ windowMs: minutos * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { ok: false, message } });
const limiteTesteComunicado = limite(10, 10, "Muitos envios de teste. Aguarde alguns minutos.");
const limiteEnvioComunicado = limite(30, 10, "Muitos envios em sequência. Aguarde alguns minutos.");

router.get("/comunicados/contexto", anttComunicar, cc.contexto);
router.get("/comunicados/clientes", anttComunicar, cc.clientes);
router.post("/comunicados/clientes", anttComunicar, cc.criarCliente);
router.put("/comunicados/clientes/:id", anttComunicar, cc.atualizarCliente);
router.delete("/comunicados/clientes/:id", anttComunicar, cc.excluirCliente);
router.post("/comunicados/visualizar", anttComunicar, cc.visualizar);
router.post("/comunicados/teste", anttComunicar, limiteTesteComunicado, receberAnexos, cc.enviarTeste);
router.post("/comunicados/enviar", anttComunicar, limiteEnvioComunicado, receberAnexos, cc.enviar);
router.get("/comunicados/historico", anttComunicar, cc.historico);
router.get("/comunicados/historico/:id", anttComunicar, cc.comunicado);
// Sem PUT/DELETE de comunicados: registros enviados não podem ser alterados.

export default router;
