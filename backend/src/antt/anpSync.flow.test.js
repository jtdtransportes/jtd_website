// Fluxo completo da sincronização com a ANP, sem rede e sem banco: a página e as planilhas oficiais são
// simuladas (fetch) e o repositório é o em memória. Cobre importação inicial, nada novo, nova publicação,
// correção de semana já publicada, ANP indisponível e carga inicial de uma localidade nova (Bahia).
import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import repo from "../repositories/antt.repository.js";
import { sincronizarAnp, URL_LEVANTAMENTO, URL_SERIE_HISTORICA_PAGINA } from "./anpSync.js";
import { instalarRepoEmMemoria } from "./fixtures/fakeRepo.js";

process.env.ANTT_ANP_RETRY_MS = "0";
const LPC = "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arquivos-lpc/2026";
const dia = (s) => new Date(`${s}T00:00:00Z`);
const fimDe = (ini) => { const d = dia(ini); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); };

/** Resumo semanal no formato oficial (abas ESTADOS e REGIOES, Diesel S10 + linhas fora do escopo). */
async function resumo(ini, { ba, ne, n }) {
  const wb = new ExcelJS.Workbook();
  const cab = ["DATA INICIAL", "DATA FINAL", "REGIAO", "ESTADOS", "PRODUTO", "NÚMERO DE POSTOS PESQUISADOS", "UNIDADE DE MEDIDA", "PREÇO MÉDIO REVENDA"];
  const es = wb.addWorksheet("ESTADOS");
  es.addRow(cab);
  es.addRow([dia(ini), dia(fimDe(ini)), "NORDESTE", "BAHIA", "OLEO DIESEL S10", 170, "R$/l", ba]);
  es.addRow([dia(ini), dia(fimDe(ini)), "NORDESTE", "PERNAMBUCO", "OLEO DIESEL S10", 90, "R$/l", 9.99]); // fora do escopo
  const rg = wb.addWorksheet("REGIOES");
  rg.addRow(["DATA INICIAL", "DATA FINAL", "REGIAO", "PRODUTO", "NÚMERO DE POSTOS PESQUISADOS", "UNIDADE DE MEDIDA", "PREÇO MÉDIO REVENDA"]);
  rg.addRow([dia(ini), dia(fimDe(ini)), "NORDESTE", "OLEO DIESEL S10", 720, "R$/l", ne]);
  rg.addRow([dia(ini), dia(fimDe(ini)), "NORTE", "OLEO DIESEL S10", 220, "R$/l", n]);
  rg.addRow([dia(ini), dia(fimDe(ini)), "SUDESTE", "OLEO DIESEL S10", 900, "R$/l", 9.99]);  // fora do escopo
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function serieVazia(aba) {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet(aba).addRow(["DATA INICIAL", "DATA FINAL", "REGIÃO", "ESTADO", "PRODUTO", "NÚMERO DE POSTOS PESQUISADOS", "UNIDADE DE MEDIDA", "PREÇO MÉDIO REVENDA"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** "ANP" simulada: arquivos publicados (url → buffer) e chave para derrubar o site. */
function anpSimulada(t) {
  const arquivos = new Map();
  const estado = { fora: false, downloads: 0 };
  const series = {};
  t.mock.method(globalThis, "fetch", async (url) => {
    if (estado.fora) throw new Error("ECONNREFUSED");
    const responder = (buf) => ({ ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
    if (url === URL_LEVANTAMENTO) return responder(Buffer.from([...arquivos.keys()].map((u) => `<a href="${u}">x</a>`).join("")));
    if (url === URL_SERIE_HISTORICA_PAGINA) return responder(Buffer.from(""));
    if (/semanal-regioes-desde/.test(url)) return responder(series.regioes ??= await serieVazia("REGIÕES - DESDE 30.12.2012"));
    if (/semanal-estados-desde/.test(url)) return responder(series.estados ??= await serieVazia("ESTADOS - DESDE 30.12.2012"));
    if (arquivos.has(url)) { estado.downloads++; return responder(arquivos.get(url)); }
    return { ok: false, status: 404 };
  });
  const publicar = async (ini, precos, sufixo = "") => arquivos.set(`${LPC}/resumo_semanal_lpc_${ini}_${fimDe(ini)}${sufixo}.xlsx`, await resumo(ini, precos));
  return { publicar, estado };
}

/** Métodos de arquivo/log/semana do repositório, em memória. */
function repoDeSync(t, db) {
  db.arquivos = new Map(); db.logs = [];
  const m = (nome, fn) => t.mock.method(repo, nome, fn);
  m("syncEmAndamentoRecente", async () => null);
  m("marcarSyncsOrfaos", async () => {});
  m("criarSyncLog", async (origem) => { db.logs.push({ id: db.logs.length + 1, origem, status: "EM_ANDAMENTO" }); return db.logs.length; });
  m("finalizarSyncLog", async (id, dados) => { Object.assign(db.logs[id - 1], dados); });
  m("purgarForaDoEscopo", async () => ({}));
  m("getArquivo", async (url) => db.arquivos.get(url) || null);
  m("salvarArquivo", async ({ url, hash }) => { db.arquivos.set(url, { url, hash_sha256: hash }); });
  m("upsertSemanais", async (rows) => {
    for (const r of rows) {
      const i = db.semanas.findIndex((s) => s.semana_inicio === r.semana_inicio && s.escopo === r.escopo && s.chave === r.chave);
      if (i >= 0) db.semanas[i] = { ...r }; else db.semanas.push({ ...r });
    }
  });
}

function preparar(t, semanas = []) {
  const db = instalarRepoEmMemoria(t, { semanas });
  repoDeSync(t, db);
  return { db, anp: anpSimulada(t) };
}
const preco = (db, ini, chave) => db.semanas.find((s) => s.semana_inicio === ini && s.chave === chave)?.preco_medio;

test("importação inicial: BA (estado), NE e N (regiões) de 2026; nada fora do escopo; médias e marco calculados", async (t) => {
  const { db, anp } = preparar(t);
  await anp.publicar("2026-01-04", { ba: 6.3, ne: 6.0, n: 6.2 });
  await anp.publicar("2026-01-11", { ba: 6.4, ne: 6.1, n: 6.3 });
  const r = await sincronizarAnp();
  assert.equal(r.status, "SUCESSO");
  assert.equal(db.semanas.length, 6);                                    // 2 semanas × (BA, NE, N); PE e SE descartados
  assert.deepEqual([...new Set(db.semanas.map((s) => `${s.escopo}:${s.chave}`))].sort(), ["ESTADO:BA", "REGIAO:N", "REGIAO:NE"]);
  assert.equal(preco(db, "2026-01-11", "BA"), "6.4000");
  assert.equal(db.medias.find((x) => x.chave === "BA" && x.mes === 1).preco_medio, "6.350000");
  assert.equal(db.medias.find((x) => x.chave === "NENO" && x.mes === 1).preco_medio, "6.150000"); // (6,05 + 6,25) / 2
  assert.equal(db.marcos.length, 1);
  assert.equal(db.logs.at(-1).status, "SUCESSO");
});

test("sem publicação nova: nada é regravado (arquivos com o mesmo conteúdo são ignorados)", async (t) => {
  const { db, anp } = preparar(t);
  await anp.publicar("2026-01-04", { ba: 6.3, ne: 6.0, n: 6.2 });
  await sincronizarAnp();
  const r = await sincronizarAnp();
  assert.equal(r.status, "SUCESSO");
  assert.equal(r.novas, 0);
  assert.equal(r.arquivos, 0);
  assert.ok(r.ignorados >= 1);
  assert.equal(db.semanas.length, 3);
});

test("nova publicação semanal entra automaticamente e atualiza a média do mês", async (t) => {
  const { db, anp } = preparar(t);
  await anp.publicar("2026-01-04", { ba: 6.3, ne: 6.0, n: 6.2 });
  await sincronizarAnp();
  await anp.publicar("2026-01-11", { ba: 6.5, ne: 6.2, n: 6.4 });
  const r = await sincronizarAnp();
  assert.equal(r.novas, 3);
  assert.equal(db.medias.find((x) => x.chave === "BA" && x.mes === 1).preco_medio, "6.400000");
});

test("correção da ANP (republicação '-1') sobrescreve a semana e recalcula; reajuste decidido é preservado", async (t) => {
  const { db, anp } = preparar(t);
  await anp.publicar("2026-01-04", { ba: 6.3, ne: 6.0, n: 6.2 });
  await anp.publicar("2026-02-01", { ba: 6.9, ne: 6.4, n: 6.6 });       // fev NE/NO 6,50 vs jan 6,10 → +6,56% → marco automático
  await sincronizarAnp();
  const auto = db.marcos.find((x) => x.origem === "GATILHO_AUTOMATICO");
  assert.ok(auto);
  auto.reajuste_id = 99;                                                // empresa já registrou a decisão
  await anp.publicar("2026-02-01", { ba: 6.9, ne: 6.3, n: 6.5 }, "-1");   // ANP corrige fevereiro: NE/NO 6,40 (+4,92%)
  const r = await sincronizarAnp();
  assert.equal(r.correcoes.length, 2);                                  // NE e N corrigidos
  assert.equal(preco(db, "2026-02-01", "NE"), "6.3000");
  assert.equal(db.medias.find((x) => x.chave === "NENO" && x.mes === 2).preco_medio, "6.400000");
  assert.ok(db.marcos.find((x) => x.id === auto.id), "marco com decisão registrada não é apagado pela correção");
});

test("ANP indisponível: mantém os últimos dados válidos, registra o erro e não grava nada fictício", async (t) => {
  const { db, anp } = preparar(t);
  await anp.publicar("2026-01-04", { ba: 6.3, ne: 6.0, n: 6.2 });
  await sincronizarAnp();
  const antes = JSON.stringify(db.semanas);
  const mediasAntes = JSON.stringify(db.medias.map((x) => [x.chave, x.mes, x.preco_medio]));
  anp.estado.fora = true;
  const r = await sincronizarAnp();
  assert.equal(r.ok, false);
  assert.equal(r.status, "ERRO");
  assert.ok(r.erros.some((e) => /Falha ao acessar/.test(e)));
  assert.equal(JSON.stringify(db.semanas), antes);
  assert.equal(JSON.stringify(db.medias.map((x) => [x.chave, x.mes, x.preco_medio])), mediasAntes);
  assert.equal(db.logs.at(-1).status, "ERRO");
  assert.equal(db.alertas.get("SYNC_ERRO")?.resolvido, false);         // aviso discreto até a próxima sincronização ok
  anp.estado.fora = false;                                              // próxima execução volta a funcionar
  const r2 = await sincronizarAnp();
  assert.equal(r2.status, "SUCESSO");
});

test("localidade nova no escopo (Bahia): relê os arquivos já processados uma vez, mesmo sem mudança de conteúdo", async (t) => {
  const { db, anp } = preparar(t);
  await anp.publicar("2026-01-04", { ba: 6.3, ne: 6.0, n: 6.2 });
  await sincronizarAnp();
  // simula o banco antigo: só NE/N gravados e o arquivo já marcado como processado
  db.semanas = db.semanas.filter((s) => s.chave !== "BA");
  const r = await sincronizarAnp();
  assert.equal(r.reprocessamento_completo, true);
  assert.equal(preco(db, "2026-01-04", "BA"), "6.3000");
  const r2 = await sincronizarAnp();
  assert.equal(r2.reprocessamento_completo, false);                     // só uma vez
});
