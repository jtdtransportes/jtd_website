// Descoberta e seleção de arquivos oficiais da ANP (sem rede).
import test from "node:test";
import assert from "node:assert/strict";
import { listarArquivosResumoSemanal, precisaReprocessar, selecionarArquivos2026, semanasFaltantes } from "./anpSync.js";

const BASE = "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arquivos-lpc";
const html = [
  `${BASE}/2026/resumo_semanal_lpc_2026_11_01-2026_11_07.xlsx`,          // nome com "_"
  `${BASE}/2026/resumo_semanal_lpc_2026-04-05-2026-04-11.xlsx`,          // nome só com "-"
  `${BASE}/2026/resumo_semanal_lpc_2026-03-08_2026-03-14-1.xlsx`,        // republicação (correção)
  `${BASE}/2026/resumo_semanal_lpc_2026-03-08_2026-03-14.xlsx`,          // original
  `${BASE}/2026/resumo_semanal_lpc_2025-12-28_2026-01-03.xlsx`,          // começa em 2025 → fora
  `${BASE}/2025/resumo_semanal_lpc-5.xlsx`,                              // sem data, pasta 2025 → fora
  `${BASE}/2022/resumo-semanal-lpc-2022-08-07-2022-08-13.xlsx`,          // hífen no prefixo
  "https://www.gov.br/anp/pt-br/qualquer/outra-coisa.xlsx",
].map((u) => `<a href="${u}">x</a>`).join("");

test("reconhece nomes irregulares e ordena republicações depois do original", () => {
  const arqs = listarArquivosResumoSemanal(html);
  assert.equal(arqs.length, 7);
  const marco = arqs.filter((a) => a.inicio === "2026-03-08");
  assert.deepEqual(marco.map((a) => a.revisao), [0, 1]); // correção processada por último → prevalece
  assert.ok(arqs.some((a) => a.inicio === "2026-11-01"));
  assert.ok(arqs.some((a) => a.inicio === "2022-08-07"));
});

test("seleciona só pesquisas iniciadas a partir de 01/01/2026", () => {
  const sel = selecionarArquivos2026(listarArquivosResumoSemanal(html));
  assert.deepEqual(sel.map((a) => a.inicio), ["2026-03-08", "2026-03-08", "2026-04-05", "2026-11-01"]);
});

test("aponta semanas faltantes por localidade (BA, NE, N) entre o 1º domingo de 2026 e a última importada", () => {
  const s = (d, chave) => ({ semana_inicio: d, chave });
  const faltas = semanasFaltantes([
    s("2026-01-04", "BA"), s("2026-01-04", "NE"), s("2026-01-04", "N"),
    s("2026-01-11", "NE"),
    s("2026-01-18", "BA"), s("2026-01-18", "NE"), s("2026-01-18", "N"),
  ]);
  assert.deepEqual(faltas, [{ semana_inicio: "2026-01-11", chave: "BA" }, { semana_inicio: "2026-01-11", chave: "N" }]);
  assert.deepEqual(semanasFaltantes([]), []);
});

test("reprocessa os arquivos já lidos quando uma localidade do escopo (ex.: Bahia) ainda não tem nenhuma semana", () => {
  const s = (escopo, chave) => ({ semana_inicio: "2026-01-04", escopo, chave });
  assert.equal(precisaReprocessar([]), false);                                                  // banco vazio: fluxo normal
  assert.equal(precisaReprocessar([s("REGIAO", "NE"), s("REGIAO", "N")]), true);                // falta BA
  assert.equal(precisaReprocessar([s("REGIAO", "NE"), s("REGIAO", "N"), s("ESTADO", "BA")]), false);
});
