// Sincronização com a ANP — escopo da planilha: Diesel S10, estado da Bahia e regiões Norte e Nordeste, semanas a partir de 01/01/2026.
// Fonte principal (obrigatória): planilhas "resumo semanal" da página Levantamento de Preços — últimas semanas.
// Complemento: séries históricas semanais oficiais por região e por estado (semanal-regioes/estados-desde-2013.xlsx),
// usadas SOMENTE para semanas que a fonte principal não disponibilizar. Usa os preços médios oficiais da ANP.
// Idempotente: chave única por (semana, região); arquivos com hash SHA-256; correções de semanas já
// publicadas sobrescrevem o valor anterior e são registradas no log; depois tudo é recalculado.
import crypto from "crypto";
import repo from "../repositories/antt.repository.js";
import { getConfig } from "./config.js";
import { lerArquivoAnp } from "./anpParser.js";
import { INICIO_SERIE, LOCALIDADES, ehLocalidade, filtrarEscopo } from "./anpCalc.js";
import { recalcularIndicadores } from "./triggers.js";
import { enviarPendentes, processarNotificacoesSeguro } from "./notificacoes.js";

export const URL_LEVANTAMENTO =
  "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas";
export const URL_SERIE_HISTORICA_PAGINA =
  "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos";
export const URL_SERIE_HISTORICA_REGIOES =
  "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/shlp/semanal/semanal-regioes-desde-2013.xlsx";
export const URL_SERIE_HISTORICA_ESTADOS =
  "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/shlp/semanal/semanal-estados-desde-2013.xlsx";
const FONTE = "ANP_RESUMO_SEMANAL";
const ARQUIVOS_RECENTES_SEMPRE_VERIFICADOS = 6;

const UA = "Mozilla/5.0 (compatible; JTD-ANTT-Monitor/1.0)";
let emExecucao = false;

export class FonteIndisponivelError extends Error {}

async function baixar(url, { tentativas = 3, timeoutMs = 90000 } = {}) {
  let ultimo;
  for (let t = 1; t <= tentativas; t++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: ctrl.signal, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      ultimo = e.name === "AbortError" ? new Error("tempo esgotado") : e;
      if (t < tentativas) await new Promise((r) => setTimeout(r, Number(process.env.ANTT_ANP_RETRY_MS ?? 1500) * t));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new FonteIndisponivelError(`Falha ao acessar ${url}: ${ultimo?.message || ultimo}`);
}

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const hrefs = (html, base) =>
  [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((m) => { try { return new URL(m[1].replace(/&amp;/g, "&"), base).href; } catch { return null; } }).filter(Boolean))];

/**
 * Lista os resumos semanais (XLSX). Os nomes na ANP são irregulares (resumo_semanal_lpc_AAAA-MM-DD_...,
 * resumo-semanal-lpc-..., resumo_semanal_lpc-5.xlsx, ...-1.xlsx para republicações); a data do nome é só
 * uma dica para filtrar/ordenar — as semanas reais são lidas do conteúdo. Republicações (sufixo -N) são
 * processadas depois da original, para que a correção prevaleça.
 */
export function listarArquivosResumoSemanal(html) {
  const out = [];
  for (const url of hrefs(html, URL_LEVANTAMENTO)) {
    const m = /\/arquivos-lpc\/(\d{4})\/(resumo[-_]semanal[^/?#]*\.xlsx)$/i.exec(url);
    if (!m) continue;
    const d = /(\d{4})[-_](\d{2})[-_](\d{1,2})/.exec(m[2]);
    const rev = /\d{4}[-_]\d{2}[-_]\d{1,2}-(\d+)\.xlsx$/i.exec(m[2]);
    out.push({ url, anoPasta: Number(m[1]), inicio: d ? `${d[1]}-${d[2]}-${d[3].padStart(2, "0")}` : null, revisao: rev ? Number(rev[1]) : 0 });
  }
  const chave = (a) => a.inicio || `${a.anoPasta}-12-31`;
  return out.sort((a, b) => chave(a).localeCompare(chave(b)) || a.revisao - b.revisao || a.url.localeCompare(b.url));
}

/** Arquivos da fonte principal que entram no escopo (2026+). */
export function selecionarArquivos2026(arquivos, inicio = INICIO_SERIE) {
  const anoInicio = Number(inicio.slice(0, 4));
  return arquivos.filter((a) => (a.inicio ? a.inicio >= inicio : a.anoPasta >= anoInicio));
}

/** Domingos (início de pesquisa) esperados entre o 1º domingo da série e a última semana importada. */
export function semanasFaltantes(semanas, inicio = INICIO_SERIE) {
  if (!semanas.length) return [];
  const ultima = semanas.map((s) => s.semana_inicio).sort().at(-1);
  const presentes = new Set(semanas.map((s) => `${s.semana_inicio}|${s.chave}`));
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7)); // primeiro domingo
  const faltas = [];
  for (; d.toISOString().slice(0, 10) <= ultima; d.setUTCDate(d.getUTCDate() + 7)) {
    const dia = d.toISOString().slice(0, 10);
    for (const { chave } of LOCALIDADES) if (!presentes.has(`${dia}|${chave}`)) faltas.push({ semana_inicio: dia, chave });
  }
  return faltas;
}

/**
 * true quando uma localidade do escopo ainda não tem nenhuma semana enquanto as outras têm (ex.: a Bahia
 * acabou de entrar no escopo). Nesse caso os arquivos já processados precisam ser lidos de novo, mesmo
 * com hash inalterado, porque antes só as regiões eram aproveitadas.
 */
export function precisaReprocessar(semanas) {
  if (!semanas.length) return false;
  return LOCALIDADES.some((l) => !semanas.some((s) => ehLocalidade(s, l.chave)));
}

/**
 * Grava semanas do escopo (BA, NE, N). modo "principal" = upsert (corrige valores existentes);
 * modo "complemento" = insere apenas semanas ausentes (não sobrescreve a fonte principal).
 * Retorna contagem de novas, corrigidas e divergências (complemento ≠ principal).
 */
async function gravarSemanas(semanais, modo) {
  const existentes = new Map((await repo.listarSemanaisRegionais({ de: INICIO_SERIE })).map((s) => [`${s.semana_inicio}|${s.escopo}|${s.chave}`, s]));
  const novas = [], corrigidas = [], divergencias = [];
  for (const s of semanais) {
    const atual = existentes.get(`${s.semana_inicio}|${s.escopo}|${s.chave}`);
    if (!atual) { novas.push(s); continue; }
    if (Number(atual.preco_medio).toFixed(4) !== Number(s.preco_medio).toFixed(4)) {
      const item = { semana_inicio: s.semana_inicio, chave: s.chave, de: atual.preco_medio, para: s.preco_medio };
      if (modo === "principal") corrigidas.push(item); else divergencias.push(item);
    }
  }
  const gravar = modo === "principal" ? semanais : novas;
  if (gravar.length) await repo.upsertSemanais(gravar, FONTE);
  return { novas: novas.length, corrigidas, divergencias, gravadas: gravar.length };
}

/** Importação manual (upload) — aceita apenas planilhas oficiais da ANP com preços médios por região/estado (XLSX). */
export async function importarArquivoManual({ buffer, nome, usuarioId }) {
  const logId = await repo.criarSyncLog("UPLOAD", usuarioId);
  try {
    const leitura = await lerArquivoAnp(buffer, nome);
    if (leitura.tipo !== "RESUMO_SEMANAL") {
      const e = new Error("Envie a planilha oficial da ANP com preços médios por região/estado (resumo semanal ou série histórica semanal, .xlsx). Microdados por posto não são aceitos.");
      e.status = 400;
      throw e;
    }
    const semanais = filtrarEscopo(leitura.semanais);
    if (!semanais.length) {
      const e = new Error("O arquivo não contém semanas de Diesel S10 da Bahia ou das regiões Norte/Nordeste a partir de 01/01/2026.");
      e.status = 422;
      throw e;
    }
    await repo.purgarForaDoEscopo(INICIO_SERIE);
    const r = await gravarSemanas(semanais, "principal");
    await repo.salvarArquivo({ url: `upload://${nome}`, fonte: FONTE, hash: sha256(buffer), tamanho: buffer.length, linhasLidas: leitura.estatisticas.linhas ?? 0, registros: r.gravadas });
    const recalculo = await recalcularIndicadores();
    await processarNotificacoesSeguro();
    const msg = `Arquivo "${nome}": ${semanais.length} semanas BA/NE/N (2026+), ${r.novas} novas, ${r.corrigidas.length} corrigidas.`;
    await repo.finalizarSyncLog(logId, { status: "SUCESSO", arquivos: 1, ignorados: 0, registros: r.gravadas, mensagem: msg, detalhes: { estatisticas: leitura.estatisticas, correcoes: r.corrigidas, recalculo } });
    return { ok: true, tipo: leitura.tipo, registros: r.gravadas, novas: r.novas, correcoes: r.corrigidas, estatisticas: leitura.estatisticas, recalculo };
  } catch (e) {
    await repo.finalizarSyncLog(logId, { status: "ERRO", arquivos: 0, ignorados: 0, registros: 0, mensagem: e.message });
    throw e;
  }
}

/** Sincronização (agendador e botão). completo=true reverifica TODOS os arquivos de 2026. */
export async function sincronizarAnp({ origem = "AUTOMATICA", usuarioId = null, completo = false } = {}) {
  if (emExecucao || (await repo.syncEmAndamentoRecente())) {
    const e = new Error("Já existe uma sincronização em andamento.");
    e.status = 409;
    throw e;
  }
  emExecucao = true;
  await repo.marcarSyncsOrfaos();
  const logId = await repo.criarSyncLog(origem, usuarioId);
  const resumo = { arquivos: 0, ignorados: 0, registros: 0, novas: 0, correcoes: [], divergencias: [], erros: [], detalhes: [] };

  async function processar(url, modo, sempreVerificar, ignorarHash = false) {
    const existente = await repo.getArquivo(url);
    if (existente && !sempreVerificar) { resumo.ignorados++; return; }
    let buf;
    try { buf = await baixar(url); } catch (e) { resumo.erros.push(e.message); return; }
    const hash = sha256(buf);
    if (existente && existente.hash_sha256 === hash && !ignorarHash) { resumo.ignorados++; return; }
    try {
      const leitura = await lerArquivoAnp(buf, url);
      if (leitura.tipo !== "RESUMO_SEMANAL") throw new Error("formato inesperado (esperado XLSX de preços por região/estado)");
      const semanais = filtrarEscopo(leitura.semanais);
      const r = semanais.length ? await gravarSemanas(semanais, modo) : { novas: 0, corrigidas: [], divergencias: [], gravadas: 0 };
      await repo.salvarArquivo({ url, fonte: FONTE, hash, tamanho: buf.length, linhasLidas: leitura.estatisticas.linhas ?? 0, registros: r.gravadas });
      resumo.arquivos++; resumo.registros += r.gravadas; resumo.novas += r.novas;
      resumo.correcoes.push(...r.corrigidas); resumo.divergencias.push(...r.divergencias);
      resumo.detalhes.push({ arquivo: url.split("/").pop(), modo, semanas_no_escopo: semanais.length, novas: r.novas, corrigidas: r.corrigidas.length, rejeitadas: leitura.estatisticas.rejeitadas });
    } catch (e) {
      resumo.erros.push(`${url.split("/").pop()}: ${e.message}`);
    }
  }

  try {
    const purga = await repo.purgarForaDoEscopo(INICIO_SERIE);
    // Localidade nova no escopo (ex.: Bahia) → relê todos os arquivos de 2026 uma vez, mesmo sem mudança de hash.
    const reprocessar = completo || precisaReprocessar(await repo.listarSemanaisRegionais({ de: INICIO_SERIE }));
    resumo.reprocessamento_completo = reprocessar;

    // 1) Fonte principal: últimas semanas pesquisadas (todas as de 2026)
    try {
      const html = (await baixar(URL_LEVANTAMENTO, { timeoutMs: 60000 })).toString("utf8");
      const arquivos = selecionarArquivos2026(listarArquivosResumoSemanal(html));
      if (!arquivos.length) resumo.erros.push("Nenhuma planilha semanal de 2026 encontrada na página da ANP (layout pode ter mudado).");
      const recentes = new Set(arquivos.filter((a) => a.inicio).slice(-ARQUIVOS_RECENTES_SEMPRE_VERIFICADOS).map((a) => a.url));
      for (const a of arquivos) await processar(a.url, "principal", reprocessar || recentes.has(a.url), reprocessar);
    } catch (e) { resumo.erros.push(e.message); }

    // 2) Complemento: séries históricas semanais oficiais por região e por estado (somente semanas ausentes)
    try {
      let links = [];
      try {
        const html = (await baixar(URL_SERIE_HISTORICA_PAGINA, { timeoutMs: 60000, tentativas: 1 })).toString("utf8");
        links = hrefs(html, URL_SERIE_HISTORICA_PAGINA);
      } catch { /* usa as URLs conhecidas */ }
      // arquivos vigentes (desde 2013); os de 2004–2012 são históricos congelados e não interessam
      for (const [padrao, conhecida] of [[/\/semanal-regioes-desde[^/]*\.xlsx$/i, URL_SERIE_HISTORICA_REGIOES], [/\/semanal-estados-desde[^/]*\.xlsx$/i, URL_SERIE_HISTORICA_ESTADOS]]) {
        await processar(links.find((h) => padrao.test(h)) || conhecida, "complemento", true, reprocessar);
      }
    } catch (e) { resumo.erros.push(e.message); }

    const recalculo = await recalcularIndicadores();
    resumo.notificacoes = await processarNotificacoesSeguro();          // novos gatilhos → e-mail (nunca derruba a sync)
    const semanas = await repo.listarSemanaisRegionais({ de: INICIO_SERIE });
    const faltantes = semanasFaltantes(semanas);
    if (faltantes.length) resumo.erros.push(`Semanas sem dados oficiais: ${faltantes.slice(0, 6).map((f) => `${f.semana_inicio} ${f.chave}`).join(", ")}${faltantes.length > 6 ? "…" : ""}`);

    const status = resumo.erros.length === 0 ? "SUCESSO" : resumo.arquivos > 0 || resumo.ignorados > 0 ? "PARCIAL" : "ERRO";
    if (status === "SUCESSO") await repo.resolverAlertaPorChave("SYNC_ERRO");
    else await repo.registrarAlerta({ alert_key: "SYNC_ERRO", tipo: "SYNC_ERRO", severidade: "ATENCAO", titulo: "Falha ou pendência na atualização da ANP", mensagem: resumo.erros.slice(0, 3).join(" | ") });
    // Dados novos/correções não geram mais alerta no dashboard; ficam registrados no log de sincronização.
    const mensagem = `${resumo.arquivos} arquivo(s) processados, ${resumo.ignorados} sem alteração; ${semanas.length} registros semana/região em 2026; ` +
      `${resumo.novas} novos, ${resumo.correcoes.length} correções${resumo.divergencias.length ? `, ${resumo.divergencias.length} divergências na série histórica (mantida a fonte principal)` : ""}.` +
      (resumo.erros.length ? ` Pendências: ${resumo.erros.slice(0, 3).join(" | ")}` : "");
    await repo.finalizarSyncLog(logId, {
      status, arquivos: resumo.arquivos, ignorados: resumo.ignorados, registros: resumo.registros, mensagem,
      detalhes: { purga, correcoes: resumo.correcoes, divergencias: resumo.divergencias, erros: resumo.erros, arquivos: resumo.detalhes, faltantes, recalculo },
    });
    return { ok: status !== "ERRO", status, ...resumo, semanas_2026: semanas.length, faltantes, recalculo };
  } catch (e) {
    await repo.finalizarSyncLog(logId, { status: "ERRO", arquivos: resumo.arquivos, ignorados: resumo.ignorados, registros: resumo.registros, mensagem: e.message });
    throw e;
  } finally {
    emExecucao = false;
  }
}

/** Agendador: na inicialização (após 30 s) e a cada 30 min verifica se já passou o intervalo configurado. */
export function iniciarAgendadorAnp() {
  if (process.env.ANTT_SYNC_DISABLED === "true") return;
  const verificar = async () => {
    try {
      const cfg = await getConfig();
      if (!cfg.sync_ativo) return;
      const [ult] = await repo.ultimosSyncLogs(1);
      const horas = cfg.sync_intervalo_horas;
      // localidade do escopo sem nenhum dado (ex.: Bahia recém-incluída) → sincroniza já, sem esperar o intervalo
      const faltaLocalidade = precisaReprocessar(await repo.listarSemanaisRegionais({ de: INICIO_SERIE }));
      if (!faltaLocalidade && ult && ult.iniciado_em && Date.now() - Date.parse(ult.iniciado_em) < horas * 3600 * 1000 && ult.status !== "ERRO") {
        await recalcularIndicadores(); // mantém "mês parcial/completo" atualizado com a data corrente
        await enviarPendentes().catch((e) => console.error("[ANTT] reenvio de notificações:", e.message));
        return;
      }
      await sincronizarAnp({ origem: "AUTOMATICA" });
    } catch (e) {
      if (e.status !== 409) console.error("[ANTT] sincronização automática falhou:", e.message);
    }
  };
  setTimeout(verificar, 30 * 1000).unref();
  setInterval(verificar, 30 * 60 * 1000).unref();
}
