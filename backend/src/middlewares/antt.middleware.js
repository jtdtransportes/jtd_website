import { verificarAcesso } from "../services/antt.service.js";

// Leitura: administradores + usuários de setores autorizados (configuração do módulo).
export async function anttLeitura(req, res, next) {
  try {
    const acesso = await verificarAcesso(req.user.id);
    if (!acesso.acesso) {
      return res.status(403).json({ ok: false, message: acesso.motivo || "Acesso negado ao módulo ANTT." });
    }
    req.anttAcesso = acesso;
    return next();
  } catch (e) {
    console.error("[ANTT] erro ao verificar acesso:", e.message);
    return res.status(500).json({ ok: false, message: "Não foi possível verificar o acesso." });
  }
}

// "Comunicar reajuste" (envio manual de e-mails a clientes e cadastro de contatos): administradores e setores autorizados.
export function anttComunicar(req, res, next) {
  if (!req.anttAcesso?.pode_comunicar) {
    return res.status(403).json({ ok: false, message: "Seu perfil não tem permissão para comunicar reajustes a clientes." });
  }
  return next();
}

// Escrita (importar, aprovar reajuste, cadastrar coeficientes etc.): somente administradores.
export function anttEscrita(req, res, next) {
  if (!req.anttAcesso?.pode_editar) {
    return res.status(403).json({ ok: false, message: "Apenas administradores podem alterar dados do módulo ANTT." });
  }
  return next();
}
