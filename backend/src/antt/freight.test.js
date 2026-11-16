import test from "node:test";
import assert from "node:assert/strict";
import { pisoMinimo, calcularFrete, calcularRetroativo } from "./freight.js";
import * as D from "./decimal.js";

// Coeficientes FICTÍCIOS usados apenas nos testes unitários (nunca gravados em produção).
const COEF = { ccd: "4.5", cc: "300" };

test("piso mínimo = distância × CCD + CC", () => {
  assert.equal(D.fmt(pisoMinimo("100", COEF), 2), "750.00");
  assert.equal(D.fmt(pisoMinimo("0.5", COEF), 2), "302.25");
  assert.throws(() => pisoMinimo("-1", COEF));
});

test("calculadora sem ajuste: apresenta coeficientes e comparação com o valor praticado", () => {
  const r = calcularFrete({ distanciaKm: "100", ...COEF, valorPraticado: "700" });
  assert.equal(r.valor_minimo, "750.00");
  assert.equal(r.valor_oficial_calculado, "750.00");
  assert.equal(r.ccd_utilizado, "4.500000");
  assert.equal(r.cc_utilizado, "300.000000");
  assert.equal(r.parcela_deslocamento, "450.00");
  assert.equal(r.comparacao.diferenca, "50.00");
  assert.equal(r.comparacao.diferenca_pct, "7.14");
  assert.equal(r.ajuste, null);
});

test("ajuste de 0,085 sem forma de aplicação definida NÃO participa do cálculo", () => {
  const r = calcularFrete({ distanciaKm: "100", ...COEF }, { valor: "0.085", modo: null, confirmado: false });
  assert.equal(r.valor_oficial_calculado, "750.00");
  assert.equal(r.ajuste.situacao, "NAO_APLICADO_FORMA_INDEFINIDA");
});

test("ajuste não confirmado é apenas simulação (não altera o valor oficial)", () => {
  const r = calcularFrete({ distanciaKm: "100", ...COEF }, { valor: "0.085", modo: "SOMAR_AO_CC", confirmado: false });
  assert.equal(r.valor_oficial_calculado, "750.00");
  assert.equal(r.ajuste.situacao, "SIMULACAO_NAO_CONFIRMADA");
  assert.equal(r.ajuste.valor_com_ajuste, "750.09"); // 750,085 → half-up exato
  assert.equal(r.ajuste.diferenca, "0.09");
});

test("ajuste confirmado entra no valor oficial, conforme a forma de aplicação", () => {
  const somaCc = calcularFrete({ distanciaKm: "100", ...COEF }, { valor: "0.085", modo: "SOMAR_AO_CC", confirmado: true });
  assert.equal(somaCc.valor_oficial_calculado, "750.09");
  const somaCcd = calcularFrete({ distanciaKm: "100", ...COEF }, { valor: "0.085", modo: "SOMAR_AO_CCD", confirmado: true });
  assert.equal(somaCcd.valor_oficial_calculado, "758.50"); // 100 × 4,585 + 300
  const pct = calcularFrete({ distanciaKm: "100", ...COEF }, { valor: "0.085", modo: "PERCENTUAL_SOBRE_CC", confirmado: true });
  assert.equal(pct.valor_oficial_calculado, "750.26");     // CC 300 × 1,00085 = 300,255
});

const NOVOS = { ccd: "4.6", cc: "310" };
const ORIG = { ccd: "4.5", cc: "300" };
const fretes = [
  { id: 1, identificacao: "CTE-1", data_frete: "2026-03-10", km: "100.5", valor_cobrado: "800.00" },
  { id: 2, identificacao: "CTE-2", data_frete: "2026-03-20", km: "200", valor_cobrado: "1200.00" },
  { id: 3, identificacao: "CTE-ANTES", data_frete: "2026-02-28", km: "50", valor_cobrado: "500.00" }, // antes da vigência
  { id: 4, identificacao: "CTE-DEPOIS", data_frete: "2026-04-05", km: "50", valor_cobrado: "500.00" }, // após o período
];
const base = { fretes, coefNovosFn: () => NOVOS, coefOriginaisFn: () => ORIG, dataVigencia: "2026-03-01", periodoInicio: "2026-01-01", periodoFim: "2026-03-31" };

test("retroativo: recalcula, soma diferenças e exclui fretes fora da vigência/período", () => {
  const r = calcularRetroativo(base);
  assert.equal(r.resumo.qtd_fretes, 2);
  assert.equal(r.ignorados.length, 2);
  assert.equal(r.resumo.km_total, "300.50");
  assert.equal(r.resumo.km_medio, "150.25");
  assert.equal(r.resumo.total_cobrado, "2000.00");
  assert.equal(r.itens[0].valor_recalculado, "772.30");   // 100,5 × 4,6 + 310
  assert.equal(r.itens[0].diferenca, "-27.70");
  assert.equal(r.itens[1].valor_recalculado, "1230.00");  // 200 × 4,6 + 310
  assert.equal(r.itens[1].diferenca, "30.00");
  assert.equal(r.resumo.total_recalculado, "2002.30");
  assert.equal(r.resumo.total_retroativo, "2.30");
});

test("retroativo: apenas diferenças positivas", () => {
  const r = calcularRetroativo({ ...base, apenasPositivas: true });
  assert.equal(r.itens[0].diferenca, "0.00");
  assert.equal(r.resumo.total_retroativo, "30.00");
});

test("retroativo: efeito separado do coeficiente por km (CCD) e do fixo (CC)", () => {
  const r = calcularRetroativo(base);
  assert.equal(r.itens[0].efeito_ccd, "10.05"); // 100,5 km × (4,6 − 4,5)
  assert.equal(r.itens[0].efeito_cc, "10.00");  // 310 − 300
  assert.equal(r.itens[1].efeito_ccd, "20.00");
});

test("retroativo: respeita a data de vigência mesmo com período anterior mais amplo", () => {
  const r = calcularRetroativo({ ...base, dataVigencia: "2026-03-15" });
  assert.deepEqual(r.itens.map((i) => i.identificacao), ["CTE-2"]);
});

test("retroativo: frete sem coeficiente aplicável é listado como ignorado (não inventa valor)", () => {
  const r = calcularRetroativo({ ...base, coefNovosFn: (f) => (f.id === 1 ? NOVOS : null) });
  assert.equal(r.resumo.qtd_fretes, 1);
  assert.ok(r.ignorados.some((i) => i.identificacao === "CTE-2" && /sem coeficiente/.test(i.motivo)));
});

test("retroativo: sem fretes elegíveis devolve zeros", () => {
  const r = calcularRetroativo({ ...base, fretes: [] });
  assert.equal(r.resumo.qtd_fretes, 0);
  assert.equal(r.resumo.km_medio, "0.00");
  assert.equal(r.resumo.total_retroativo, "0.00");
});

test("retroativo: soma de centavos exata (sem erro de float)", () => {
  const muitos = Array.from({ length: 1000 }, (_, i) => ({ id: i, identificacao: `V${i}`, data_frete: "2026-03-10", km: "10", valor_cobrado: "0.10" }));
  const r = calcularRetroativo({ ...base, fretes: muitos, coefNovosFn: () => ({ ccd: "0.01", cc: "0" }), coefOriginaisFn: () => null });
  assert.equal(r.resumo.total_recalculado, "100.00"); // 1000 × 0,10
  assert.equal(r.resumo.total_retroativo, "0.00");
});
