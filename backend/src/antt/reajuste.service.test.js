// Regras de marcos e tabelas ANTT no serviço (repositório em memória — não toca no banco).
import test from "node:test";
import assert from "node:assert/strict";
import * as svc from "../services/antt.service.js";
import { recalcularIndicadores } from "./triggers.js";
import { instalarRepoEmMemoria, mesInteiro } from "./fixtures/fakeRepo.js";

const SEMANAS = [...mesInteiro(2026, 1, "6.00", "6.20"), ...mesInteiro(2026, 2, "6.50", "6.70"), ...mesInteiro(2026, 3, "6.40", "6.60")];

async function preparar(t, semanas = SEMANAS) {
  const db = instalarRepoEmMemoria(t, { semanas });
  await recalcularIndicadores({ hoje: "2026-11-11" });
  return db;
}

test("redefinir marco gerencial: só a partir de mês ENCERRADO da série NE/NO e com motivo", async (t) => {
  const db = await preparar(t);
  await assert.rejects(() => svc.criarMarco({ ref_ano: 2026, ref_mes: 2 }, 1), /motivo/i);
  await assert.rejects(() => svc.criarMarco({ ref_ano: 2026, ref_mes: 9, observacao: "teste de mês sem dados" }, 1), /Não há média/);
  const r = await svc.criarMarco({ ref_ano: 2026, ref_mes: 2, observacao: "Novo contrato a partir de março", preco_referencia: "1.00" }, 4);
  assert.equal(r.preco_referencia, "6.600000"); // preço digitado é ignorado: vem da série
  assert.equal(db.marcos.length, 2);
  assert.equal(db.marcos.filter((m) => m.vigente).length, 1);
});

test("marco regulatório exige documento oficial e não altera o marco gerencial", async (t) => {
  const db = await preparar(t);
  await assert.rejects(() => svc.criarMarco({ tipo: "REGULATORIO", ref_ano: 2026, ref_mes: 1, preco_referencia: "6.1" }, 1), /documento/i);
  await svc.criarMarco({ tipo: "REGULATORIO", ref_ano: 2026, ref_mes: 1, preco_referencia: "6.1", fonte_documento: "Resolução ANTT nº X" }, 1);
  assert.equal(db.marcos.filter((m) => m.tipo === "GERENCIAL" && m.vigente).length, 1);
  assert.equal(db.marcos.filter((m) => m.tipo === "REGULATORIO").length, 1);
});

test("tabela ANTT: fonte precisa ser oficial (gov.br) e eixos não podem repetir", async (t) => {
  await preparar(t);
  const base = { tabela: "A", vigencia_inicio: "2026-01-01", norma: "Resolução X", itens: [{ eixos: 2, ccd: "1", cc: "1" }] };
  await assert.rejects(() => svc.criarTabelaFrete({ ...base, fonte_url: "https://exemplo.com/tabela" }, 1), /oficial/);
  await assert.rejects(() => svc.criarTabelaFrete({ ...base, fonte_url: "https://www.gov.br/antt/x", itens: [{ eixos: 2, ccd: "1", cc: "1" }, { eixos: 2, ccd: "2", cc: "2" }] }, 1), /repetida/);
});

test("monitoramento: dados desatualizados sem sync ok recente (> 36 h) ou com a última pesquisa > 13 dias", () => {
  const agora = new Date("2026-11-14T12:00:00Z");
  assert.equal(svc.situacaoAtualizacao({ ultimoOk: null, agora }).desatualizado, true);
  assert.equal(svc.situacaoAtualizacao({ ultimoOk: { finalizado_em: "2026-11-14T06:00:00Z" }, ultimaSemana: "2026-11-07", agora }).desatualizado, false);
  assert.match(svc.situacaoAtualizacao({ ultimoOk: { finalizado_em: "2026-11-12T06:00:00Z" }, ultimaSemana: "2026-11-07", agora }).motivo, /sincronização/);
  assert.match(svc.situacaoAtualizacao({ ultimoOk: { finalizado_em: "2026-11-14T06:00:00Z" }, ultimaSemana: "2026-10-24", agora }).motivo, /pesquisa/);
});
