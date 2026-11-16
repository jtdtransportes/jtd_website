// Configurações do módulo ANTT: valores padrão + sobreposição salva no banco.
import { z } from "zod";
import repo from "../repositories/antt.repository.js";
import { MODOS_AJUSTE_CC } from "./freight.js";

const anoPassado = new Date().getFullYear() - 1;

export const CONFIG_PADRAO = {
  limite_gatilho_pct: "5",                 // gatilho gerencial (±)
  escopo_padrao: "BRASIL",
  chave_padrao: "BR",
  fonte_preferida: "ANP_RESUMO_SEMANAL",     // série oficial publicada pela ANP (microdados ficam como alternativa)
  metodologia_padrao: "MEDIA_SIMPLES_SEMANAS",
  sync_ativo: "true",
  sync_intervalo_horas: "6",
  sync_desde: `${anoPassado}-12`,          // primeiro mês importado (AAAA-MM)
  setores_autorizados: "[]",               // ids de setores com acesso de LEITURA (admins sempre têm acesso)
  setores_comunicados: "[]",               // setores (já autorizados) que podem usar "Comunicar reajuste" (admins sempre)
  ajuste_cc_valor: "0.085",                // ajuste adicional solicitado (coeficiente de carga)
  ajuste_cc_modo: "",                      // forma de aplicação: NÃO definida até confirmação
  ajuste_cc_confirmado: "false",           // só participa do cálculo oficial quando "true"
  notificacao_email_ativo: "false",        // legado (substituído pelas chaves notif_*)
  notificacao_emails: "[]",
  // Notificações por e-mail de gatilhos (alteradas só por /notificacoes/config, nunca pelo PUT genérico)
  notif_ativo: "false",
  notif_modo: "TESTE",                     // TESTE: envia SÓ ao e-mail de teste · PRODUCAO: ao oficial
  notif_email_teste: "",
  notif_email_oficial: "",
  notif_inicio: "",                        // início do monitoramento (ISO); gatilhos anteriores ficam só no histórico
};

const schema = z.object({
  limite_gatilho_pct: z.coerce.number().gt(0).lte(100),
  escopo_padrao: z.enum(["BRASIL", "REGIAO", "ESTADO"]),
  chave_padrao: z.string().trim().min(1).max(4).toUpperCase(),
  fonte_preferida: z.enum(["ANP_RESUMO_SEMANAL", "ANP_MICRODADOS"]),
  metodologia_padrao: z.enum(["MEDIA_SIMPLES_SEMANAS", "MEDIA_PONDERADA_POSTOS"]),
  sync_ativo: z.boolean(),
  sync_intervalo_horas: z.coerce.number().int().min(1).max(168),
  sync_desde: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  setores_autorizados: z.array(z.coerce.number().int().positive()),
  setores_comunicados: z.array(z.coerce.number().int().positive()),
  ajuste_cc_valor: z.string().regex(/^\d+([.,]\d+)?$/),
  ajuste_cc_modo: z.enum(["", ...Object.keys(MODOS_AJUSTE_CC)]),
  ajuste_cc_confirmado: z.boolean(),
  notificacao_email_ativo: z.boolean(),
  notificacao_emails: z.array(z.string().email()).max(20),
}).partial();

function decode(raw) {
  const c = { ...CONFIG_PADRAO, ...raw };
  const parseJson = (v, fb) => { try { return JSON.parse(v); } catch { return fb; } };
  return {
    limite_gatilho_pct: String(c.limite_gatilho_pct),
    escopo_padrao: c.escopo_padrao,
    chave_padrao: c.chave_padrao,
    fonte_preferida: c.fonte_preferida,
    metodologia_padrao: c.metodologia_padrao,
    sync_ativo: c.sync_ativo === "true",
    sync_intervalo_horas: Number(c.sync_intervalo_horas),
    sync_desde: c.sync_desde,
    setores_autorizados: parseJson(c.setores_autorizados, []),
    setores_comunicados: parseJson(c.setores_comunicados, []),
    ajuste_cc_valor: String(c.ajuste_cc_valor).replace(",", "."),
    ajuste_cc_modo: c.ajuste_cc_modo,
    ajuste_cc_confirmado: c.ajuste_cc_confirmado === "true",
    notificacao_email_ativo: c.notificacao_email_ativo === "true",
    notificacao_emails: parseJson(c.notificacao_emails, []),
    notif_ativo: c.notif_ativo === "true",
    notif_modo: c.notif_modo === "PRODUCAO" ? "PRODUCAO" : "TESTE",
    notif_email_teste: c.notif_email_teste || "",
    notif_email_oficial: c.notif_email_oficial || "",
    notif_inicio: c.notif_inicio || "",
  };
}

export async function getConfig() {
  return decode(await repo.getConfigRows());
}

export async function updateConfig(input, userId, ip) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const err = new Error("Configuração inválida: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
    err.status = 400;
    throw err;
  }
  const antes = await getConfig();
  const dados = parsed.data;
  // O ajuste só pode ser confirmado se a forma de aplicação estiver definida.
  const depoisPrevisto = { ...antes, ...dados };
  if (depoisPrevisto.ajuste_cc_confirmado && !depoisPrevisto.ajuste_cc_modo) {
    const err = new Error("Defina a forma de aplicação do ajuste antes de confirmá-lo.");
    err.status = 400;
    throw err;
  }
  for (const [k, v] of Object.entries(dados)) {
    const valor = Array.isArray(v) ? JSON.stringify(v) : typeof v === "boolean" ? String(v) : String(v);
    await repo.setConfig(k, valor, userId);
  }
  const depois = await getConfig();
  await repo.audit({ usuarioId: userId, acao: "CONFIG_ATUALIZADA", entidade: "antt_configuracoes", antes, depois, ip });
  return depois;
}
