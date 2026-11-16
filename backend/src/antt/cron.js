// Disparo externo da sincronização ANP (ex.: GitHub Actions agendado), para ambientes em que a instância
// pode hibernar (Render free) e o agendador interno não roda. Protegido por segredo compartilhado
// (variável de ambiente ANTT_CRON_SECRET, mínimo 24 caracteres). Sem o segredo configurado, o endpoint fica desativado.
import crypto from "crypto";
import { sincronizarAnp } from "./anpSync.js";

export function segredoValido(recebido, esperado = process.env.ANTT_CRON_SECRET) {
  if (!esperado || esperado.length < 24 || typeof recebido !== "string" || !recebido) return false;
  const a = crypto.createHash("sha256").update(recebido).digest();
  const b = crypto.createHash("sha256").update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function cronSync(req, res) {
  if (!process.env.ANTT_CRON_SECRET) return res.status(404).json({ ok: false, message: "Disparo externo desativado." });
  if (!segredoValido(req.get("x-antt-cron-secret"))) return res.status(401).json({ ok: false, message: "Não autorizado." });
  try {
    const r = await sincronizarAnp({ origem: "AUTOMATICA" });
    return res.json({
      ok: r.ok, status: r.status, arquivos: r.arquivos, ignorados: r.ignorados, novas: r.novas,
      correcoes: r.correcoes.length, semanas_2026: r.semanas_2026, faltantes: r.faltantes.length, erros: r.erros.slice(0, 5),
    });
  } catch (e) {
    if (e.status === 409) return res.json({ ok: true, status: "EM_ANDAMENTO", message: e.message });
    console.error("[ANTT] cron sync:", e.message);
    return res.status(502).json({ ok: false, message: "Falha na sincronização com a ANP." });
  }
}
