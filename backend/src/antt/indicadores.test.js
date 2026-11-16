// Fluxo completo dos indicadores NE/NO com repositório em memória (não toca no banco):
// recálculo → marco inicial automático → gatilho → marco zero automático (cadeia) → correção de semana.
import test from "node:test";
import assert from "node:assert/strict";
import { recalcularIndicadores, carregarIndicadores } from "./triggers.js";
import * as svc from "../services/antt.service.js";
import { instalarRepoEmMemoria, mesInteiro, semana } from "./fixtures/fakeRepo.js";

const HOJE = "2026-11-11";
// jan: NE 6,00 / NO 6,20 → NE/NO 6,10 (marco inicial)
const BASE = [...mesInteiro(2026, 1, "6.00", "6.20"), ...mesInteiro(2026, 2, "6.10", "6.30")];

test("marco inicial automático = média NE/NO de janeiro/2026, sem digitar preço", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: BASE });
  const r = await recalcularIndicadores({ hoje: HOJE });
  assert.equal(r.marco_inicial.acao, "CRIADO");
  assert.equal(db.marcos.length, 1);
  assert.equal(db.marcos[0].preco_referencia, "6.100000");
  assert.equal(db.marcos[0].origem, "INICIAL_AUTOMATICO");
  assert.equal(db.marcos[0].ref_mes, 1);
  // recalcular de novo não cria outro marco
  await recalcularIndicadores({ hoje: HOJE });
  assert.equal(db.marcos.length, 1);
});

test("sem dados de janeiro/2026 não cria marco (nada inventado)", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: mesInteiro(2026, 2, "6.10", "6.30") });
  const r = await recalcularIndicadores({ hoje: HOJE });
  assert.equal(r.marco_inicial.acao, "AGUARDANDO_DADOS_JANEIRO");
  assert.equal(db.marcos.length, 0);
});

test("médias persistidas: NE, NO e NE/NO para cada mês", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: BASE });
  await recalcularIndicadores({ hoje: HOJE });
  const fev = (chave) => db.medias.find((m) => m.chave === chave && m.mes === 2).preco_medio;
  assert.equal(fev("NE"), "6.100000");
  assert.equal(fev("N"), "6.300000");
  assert.equal(fev("NENO"), "6.200000");
});

const marcosOrdenados = (db) => [...db.marcos].sort((a, b) => a.ref_ano * 12 + a.ref_mes - (b.ref_ano * 12 + b.ref_mes));
const vigente = (db) => db.marcos.find((m) => m.vigente);
const acumulado = async () => Object.fromEntries((await carregarIndicadores()).series.NENO.map((m) => [m.mes, m.variacao_acumulada_pct]));

test("gatilho de aumento em exatamente +5%: o mês vira marco zero automático, com UM aviso informativo", async (t) => {
  // março NE/NO = 6,405 = 6,10 × 1,05
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, ...mesInteiro(2026, 3, "6.30", "6.51")] });
  const r = await recalcularIndicadores({ hoje: HOJE });
  assert.deepEqual(r.marcos_automaticos.criados, ["03/2026"]);
  assert.equal(db.marcos.length, 2);
  const auto = vigente(db);
  assert.deepEqual([auto.origem, auto.ref_mes, auto.preco_referencia], ["GATILHO_AUTOMATICO", 3, "6.405000"]);
  assert.equal(db.marcos.find((m) => m.origem === "INICIAL_AUTOMATICO").vigente, false);
  assert.match(auto.observacao, /\+5,00% sobre o marco de 01\/2026/);
  const alerta = db.alertas.get("MARCO_AUTOMATICO:2026-3");
  assert.deepEqual([alerta.tipo, alerta.severidade, alerta.resolvido], ["MARCO_AUTOMATICO", "INFO", false]);
  assert.match(alerta.mensagem, /\+5,00%/);
  assert.deepEqual(await acumulado(), { 1: "0.0000", 2: "1.6393", 3: "0.0000" });
  assert.equal(db.gatilhos.length, 0); // nada fica aguardando confirmação
  // nova sincronização sem mudança: nada duplicado
  await recalcularIndicadores({ hoje: HOJE });
  await recalcularIndicadores({ hoje: HOJE });
  assert.equal(db.marcos.length, 2);
  assert.equal([...db.alertas.keys()].length, 1);
});

test("gatilho de redução em exatamente −5% também vira marco zero", async (t) => {
  // março NE/NO = 5,795 = 6,10 × 0,95
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, ...mesInteiro(2026, 3, "5.70", "5.89")] });
  await recalcularIndicadores({ hoje: HOJE });
  assert.deepEqual([vigente(db).ref_mes, vigente(db).preco_referencia], [3, "5.795000"]);
  assert.match(vigente(db).observacao, /-5,00%.*redução/);
});

test("entre −5% e +5% não cria marco", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, ...mesInteiro(2026, 3, "6.30", "6.50")] }); // +4,92%
  await recalcularIndicadores({ hoje: HOJE });
  assert.equal(db.marcos.length, 1);
  assert.equal(vigente(db).origem, "INICIAL_AUTOMATICO");
});

test("cadeia: cada mês que passa do limite vira marco e o acumulado recomeça nele", async (t) => {
  // NE/NO: jan 6,10 · fev 6,20 · mar 6,60 (+8,20% → marco) · abr 6,70 · mai 6,25 (−5,30% → marco) · jun 6,40
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, ...mesInteiro(2026, 3, "6.50", "6.70"), ...mesInteiro(2026, 4, "6.60", "6.80"),
    ...mesInteiro(2026, 5, "6.15", "6.35"), ...mesInteiro(2026, 6, "6.30", "6.50")] });
  await recalcularIndicadores({ hoje: HOJE });
  assert.deepEqual(marcosOrdenados(db).map((m) => [m.ref_mes, m.origem]), [[1, "INICIAL_AUTOMATICO"], [3, "GATILHO_AUTOMATICO"], [5, "GATILHO_AUTOMATICO"]]);
  assert.equal(vigente(db).ref_mes, 5);
  assert.deepEqual(await acumulado(), { 1: "0.0000", 2: "1.6393", 3: "0.0000", 4: "1.5152", 5: "0.0000", 6: "2.4000" });
});

test("correção da ANP remove o marco automático que deixou de atingir o gatilho e o recria se voltar", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, ...mesInteiro(2026, 3, "6.30", "6.51")] });
  await recalcularIndicadores({ hoje: HOJE });
  assert.equal(vigente(db).origem, "GATILHO_AUTOMATICO"); // +5,00% em março
  // ANP corrige a 1ª semana de março no Nordeste: 6,30 → 6,26 ⇒ NE mar = 6,292; NE/NO mar = 6,401 ⇒ +4,93%
  const i = db.semanas.findIndex((s) => s.semana_inicio === "2026-03-01" && s.chave === "NE");
  db.semanas[i] = semana("2026-03-01", "NE", "6.26");
  const r = await recalcularIndicadores({ hoje: HOJE });
  assert.deepEqual(r.marcos_automaticos.removidos, ["03/2026"]);
  assert.equal(db.medias.find((m) => m.chave === "NENO" && m.mes === 3).preco_medio, "6.401000");
  assert.equal(db.marcos.length, 1);
  assert.equal(vigente(db).origem, "INICIAL_AUTOMATICO");
  assert.equal(db.alertas.get("MARCO_AUTOMATICO:2026-3").resolvido, true);
  // ANP corrige janeiro: o marco inicial acompanha (6,10 → 6,0875) e março volta a passar de +5%
  const j = db.semanas.findIndex((s) => s.semana_inicio === "2026-01-04" && s.chave === "NE");
  db.semanas[j] = semana("2026-01-04", "NE", "5.90");
  const r2 = await recalcularIndicadores({ hoje: HOJE });
  assert.equal(r2.marco_inicial.acao, "ATUALIZADO");
  assert.equal(db.marcos.find((m) => m.origem === "INICIAL_AUTOMATICO").preco_referencia, "6.087500");
  assert.deepEqual([vigente(db).origem, vigente(db).ref_mes, vigente(db).preco_referencia], ["GATILHO_AUTOMATICO", 3, "6.401000"]);
  assert.equal(db.alertas.get("MARCO_AUTOMATICO:2026-3").resolvido, false); // mesmo aviso reaberto, sem duplicar
});

test("marco do mês parcial acompanha as novas pesquisas até o mês fechar", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, semana("2026-03-01", "NE", "6.50"), semana("2026-03-01", "N", "6.70")] });
  await recalcularIndicadores({ hoje: "2026-03-10" });
  assert.deepEqual([vigente(db).ref_mes, vigente(db).preco_referencia], [3, "6.600000"]);
  assert.match(vigente(db).observacao, /mês parcial/);
  db.semanas.push(semana("2026-03-08", "NE", "6.70"), semana("2026-03-08", "N", "6.90"));
  await recalcularIndicadores({ hoje: "2026-03-17" });
  assert.equal(db.marcos.length, 2);
  assert.equal(vigente(db).preco_referencia, "6.700000");
});

test("gatilho que ficou aberto na regra antiga é encerrado e seu alerta resolvido", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, ...mesInteiro(2026, 3, "6.50", "6.70")] });
  db.gatilhos.push({ id: 1, marco_id: 1, direcao: "ALTA", status: "ABERTO" });
  db.alertas.set("GATILHO:1", { alert_key: "GATILHO:1", tipo: "GATILHO_ALTA", resolvido: false, resolvido_por: null });
  const r = await recalcularIndicadores({ hoje: HOJE });
  assert.equal(r.gatilhos_legados_encerrados, 1);
  assert.equal(db.gatilhos[0].status, "MARCO_AUTOMATICO");
  assert.equal(db.alertas.get("GATILHO:1").resolvido, true);
});

test("redefinição manual do marco reinicia a cadeia a partir do mês escolhido", async (t) => {
  // mar 6,60 (+8,20% → marco automático) · abr 6,70 · mai 7,10 (+7,58% sobre mar → marco automático)
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, ...mesInteiro(2026, 3, "6.50", "6.70"), ...mesInteiro(2026, 4, "6.60", "6.80"), ...mesInteiro(2026, 5, "7.00", "7.20")] });
  await recalcularIndicadores({ hoje: HOJE });
  assert.deepEqual(marcosOrdenados(db).map((m) => m.ref_mes), [1, 3, 5]);
  // marco manual em abril (6,70): maio fica +5,97% sobre abril → o marco automático passa a valer contra abril
  await svc.criarMarco({ ref_ano: 2026, ref_mes: 4, observacao: "Novo contrato a partir de abril" }, 9);
  assert.deepEqual(marcosOrdenados(db).map((m) => [m.ref_mes, m.origem]), [[1, "INICIAL_AUTOMATICO"], [3, "GATILHO_AUTOMATICO"], [4, "MES_DA_SERIE"], [5, "GATILHO_AUTOMATICO"]]);
  assert.match(vigente(db).observacao, /\+5,97% sobre o marco de 04\/2026/);
  assert.deepEqual(await acumulado(), { 1: "0.0000", 2: "1.6393", 3: "0.0000", 4: "0.0000", 5: "0.0000" });
});

test("mês corrente fica parcial e entra marcado como tal", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, semana("2026-11-01", "NE", "6.10"), semana("2026-11-01", "N", "6.30")] });
  await recalcularIndicadores({ hoje: HOJE });
  assert.equal(db.medias.find((m) => m.chave === "NENO" && m.mes === 11).mes_completo, false);
  assert.equal(db.medias.find((m) => m.chave === "NENO" && m.mes === 2).mes_completo, true);
});

test("Bahia: média mensal própria (dados estaduais), persistida como ESTADO e nunca copiada do NE/NO", async (t) => {
  // BA jan 6,30 / fev 6,40 (semanas estaduais); NE/NO jan 6,10 / fev 6,20
  const db = instalarRepoEmMemoria(t, { semanas: [...mesInteiro(2026, 1, "6.00", "6.20", "6.30"), ...mesInteiro(2026, 2, "6.10", "6.30", "6.40")] });
  const r = await recalcularIndicadores({ hoje: HOJE });
  assert.deepEqual(r.meses, { BA: 2, NE: 2, N: 2, NENO: 2 });
  const fev = (escopo, chave) => db.medias.find((m) => m.escopo === escopo && m.chave === chave && m.mes === 2).preco_medio;
  assert.equal(fev("ESTADO", "BA"), "6.400000");
  assert.equal(fev("COMBINADO", "NENO"), "6.200000");
  const { series } = await carregarIndicadores();
  assert.equal(series.BA[1].variacao_mensal_pct, "1.5873");          // 6,40 / 6,30 − 1 (só preços da BA)
  assert.equal(series.BA[1].variacao_acumulada_pct, "1.5873");       // contra o preço da BA no mês do marco (jan)
  assert.equal(series.BA[0].marco_ref.preco, "6.300000");
});

test("Bahia não dispara gatilho nem cria marco: a referência continua sendo o NE/NO", async (t) => {
  // BA sobe 9,5% em fevereiro; NE/NO só +1,64% → nenhum marco novo
  const db = instalarRepoEmMemoria(t, { semanas: [...mesInteiro(2026, 1, "6.00", "6.20", "6.30"), ...mesInteiro(2026, 2, "6.10", "6.30", "6.90")] });
  await recalcularIndicadores({ hoje: HOJE });
  assert.equal(db.marcos.length, 1);
  assert.equal(db.marcos[0].origem, "INICIAL_AUTOMATICO");
  const { series } = await carregarIndicadores();
  assert.equal(series.BA[1].gatilho, "ALTA");      // exibido para comparação
  assert.equal(series.NENO[1].gatilho, "SEM_GATILHO");
});

test("sem semanas da Bahia, NE/NO e regiões continuam funcionando (BA fica vazio, nada inventado)", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: BASE });
  const r = await recalcularIndicadores({ hoje: HOJE });
  assert.equal(r.meses.BA, 0);
  assert.equal(db.medias.filter((m) => m.chave === "BA").length, 0);
  const { series } = await carregarIndicadores();
  assert.deepEqual(series.BA, []);
});

test("decisão de reajuste: exige confirmação e data, grava aprovador e fixa o marco (correção da ANP não o remove)", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, ...mesInteiro(2026, 3, "6.30", "6.51")] }); // mar +5,00% → marco automático
  await recalcularIndicadores({ hoje: HOJE });
  const auto = db.marcos.find((m) => m.origem === "GATILHO_AUTOMATICO");
  await assert.rejects(() => svc.registrarDecisaoReajuste({ marco_id: auto.id, aplicado: true, data_aplicacao: "2026-04-01" }, 7), /confirma/i);
  await assert.rejects(() => svc.registrarDecisaoReajuste({ marco_id: auto.id, aplicado: true, confirmar: true }, 7), /data de aplicação/i);
  await assert.rejects(() => svc.registrarDecisaoReajuste({ marco_id: 1, aplicado: true, data_aplicacao: "2026-04-01", confirmar: true }, 7), /gatilho/i); // marco inicial
  const r = await svc.registrarDecisaoReajuste({ marco_id: auto.id, aplicado: true, data_aplicacao: "2026-04-01", percentual_aplicado: "5", confirmar: true }, 7);
  assert.deepEqual([r.status, r.direcao, r.variacao_pct, r.preco_referencia, r.preco_apurado, r.data_vigencia], ["APROVADO", "ALTA", "5.0000", "6.100000", "6.405000", "2026-04-01"]);
  assert.equal(db.reajustes[0].aprovado_por, 7);
  assert.equal(db.marcos.find((m) => m.id === auto.id).reajuste_id, r.reajusteId);
  assert.equal(db.alertas.get("MARCO_AUTOMATICO:2026-3").resolvido, true);
  await assert.rejects(() => svc.registrarDecisaoReajuste({ marco_id: auto.id, aplicado: false, confirmar: true }, 7), /já foi registrada/);
  // ANP corrige março para +4,93%: sem decisão o marco sumiria; com decisão ele permanece (fixo)
  const i = db.semanas.findIndex((s) => s.semana_inicio === "2026-03-01" && s.chave === "NE");
  db.semanas[i] = semana("2026-03-01", "NE", "6.26");
  await recalcularIndicadores({ hoje: HOJE });
  const fixo = db.marcos.find((m) => m.id === auto.id);
  assert.ok(fixo);
  assert.equal(fixo.preco_referencia, "6.405000"); // não é recalculado
  assert.equal(fixo.vigente, true);
});

test("decisão 'não aplicado' fica registrada sem data de aplicação informada e sem alterar o marco", async (t) => {
  const db = instalarRepoEmMemoria(t, { semanas: [...BASE, ...mesInteiro(2026, 3, "5.70", "5.89")] }); // −5,00%
  await recalcularIndicadores({ hoje: HOJE });
  const auto = db.marcos.find((m) => m.origem === "GATILHO_AUTOMATICO");
  const r = await svc.registrarDecisaoReajuste({ marco_id: auto.id, aplicado: false, observacao: "Cliente com contrato fixo", confirmar: true }, 3);
  assert.deepEqual([r.status, r.direcao, r.percentual_aplicado, r.justificativa], ["REJEITADO", "BAIXA", null, "Cliente com contrato fixo"]);
  assert.equal(db.marcos.length, 2);
  assert.equal(db.marcos.find((m) => m.id === auto.id).preco_referencia, "5.795000");
});
