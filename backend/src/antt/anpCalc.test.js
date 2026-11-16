import test from "node:test";
import assert from "node:assert/strict";
import {
  semanaDe, mesDaSemana, mesCompleto, filtrarEscopo, mediasMensais, mediaCombinada, marcoDoMes, serieIndicador,
  marcosParaRegiao, detectarGatilhos, distanciaGatilhos, tabelaPlanilha, cadeiaMarcosAutomaticos,
} from "./anpCalc.js";

const sem = (inicio, preco, chave = "NE") => {
  const fim = new Date(`${inicio}T00:00:00Z`); fim.setUTCDate(fim.getUTCDate() + 6);
  return { semana_inicio: inicio, semana_fim: fim.toISOString().slice(0, 10), preco_medio: preco, n_postos: 100, escopo: "REGIAO", chave };
};
const HOJE = "2026-11-11";

test("semana domingo→sábado", () => {
  assert.deepEqual(semanaDe("2026-01-01"), { inicio: "2025-12-28", fim: "2026-01-03" });
  assert.deepEqual(semanaDe("2026-01-04"), { inicio: "2026-01-04", fim: "2026-01-10" });
});

test("regra de corte: a semana pertence ao mês da DATA INICIAL da pesquisa", () => {
  assert.deepEqual(mesDaSemana("2026-03-29"), { ano: 2026, mes: 3 });  // 29/03–04/04 → março
  assert.deepEqual(mesDaSemana("2026-05-31"), { ano: 2026, mes: 5 });  // 31/05–06/06 → maio
  assert.deepEqual(mesDaSemana("2025-12-28"), { ano: 2025, mes: 12 }); // 28/12/25–03/01/26 → dez/2025
});

test("escopo: estado BA e regiões NE/N a partir de 01/01/2026 (descarta Brasil, outras regiões, outros estados e 2025)", () => {
  const entrada = [
    sem("2026-01-04", "6.02", "NE"), sem("2026-01-04", "6.25", "N"),
    { ...sem("2026-01-04", "6.10", "SE") }, { ...sem("2026-01-04", "6.10", "BR"), escopo: "BRASIL" },
    { ...sem("2026-01-04", "6.10", "BA"), escopo: "ESTADO" }, { ...sem("2026-01-04", "6.20", "PE"), escopo: "ESTADO" },
    { ...sem("2025-12-28", "6.00", "BA"), escopo: "ESTADO" }, sem("2025-12-28", "6.00", "NE"),
    sem("2026-01-04", "6.10", "BA"), // "BA" com escopo de região não existe na ANP → descartado
  ];
  assert.deepEqual(filtrarEscopo(entrada).map((s) => `${s.escopo}:${s.chave}@${s.semana_inicio}`), ["REGIAO:NE@2026-01-04", "REGIAO:N@2026-01-04", "ESTADO:BA@2026-01-04"]);
});

test("média mensal = média aritmética simples dos preços semanais regionais (dados reais de jan/2026)", () => {
  // Nordeste, ANP: 04/01=6,02 · 11/01=6,03 · 18/01=6,04 · 25/01=6,04 → 6,0325
  const ne = mediasMensais([sem("2026-01-04", "6.02"), sem("2026-01-11", "6.03"), sem("2026-01-18", "6.04"), sem("2026-01-25", "6.04")], { hoje: HOJE });
  assert.equal(ne.length, 1);
  assert.equal(ne[0].preco_medio, "6.032500");
  assert.equal(ne[0].n_semanas, 4);
  assert.equal(ne[0].mes_completo, true);
});

test("mês com 5 pesquisas (início em 29/03 conta em março)", () => {
  const r = mediasMensais(["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22", "2026-03-29"].map((d, i) => sem(d, String(7 + i * 0.01))), { hoje: HOJE });
  assert.equal(r.length, 1);
  assert.equal(r[0].n_semanas, 5);
  assert.equal(r[0].preco_medio, "7.020000");
});

test("mês parcial: mês corrente, ou sem a pesquisa do último domingo; tolerância de 14 dias", () => {
  assert.equal(mesCompleto(2026, 11, ["2026-11-01"], "2026-11-11"), false);              // mês em curso
  assert.equal(mesCompleto(2026, 10, ["2026-10-04", "2026-10-25"], "2026-11-03"), true); // último domingo (25/10) importado
  assert.equal(mesCompleto(2026, 10, ["2026-10-04", "2026-10-18"], "2026-11-03"), false);// falta a pesquisa de 25/10
  assert.equal(mesCompleto(2026, 10, ["2026-10-04", "2026-10-18"], "2026-11-20"), true); // ANP não publicou: fecha após 14 dias
});

test("média NE/NO = média simples das duas médias regionais (só meses com ambas)", () => {
  const ne = mediasMensais([sem("2026-01-04", "6.02"), sem("2026-01-11", "6.03"), sem("2026-01-18", "6.04"), sem("2026-01-25", "6.04"), sem("2026-02-01", "6.00")], { hoje: HOJE });
  const n = mediasMensais([sem("2026-01-04", "6.25", "N"), sem("2026-01-11", "6.26", "N"), sem("2026-01-18", "6.27", "N"), sem("2026-01-25", "6.28", "N")], { hoje: HOJE });
  const c = mediaCombinada(ne, n);
  assert.equal(c.length, 1);                 // fevereiro só tem NE → sem média combinada (nada inventado)
  assert.equal(c[0].preco_medio, "6.148750"); // (6,0325 + 6,2650) / 2 — valor real de jan/2026
  assert.equal(c[0].preco_ne, "6.032500");
  assert.equal(c[0].preco_no, "6.265000");
});

test("média NE/NO é calculada sobre valores exatos (sem arredondamento intermediário)", () => {
  const ne = mediasMensais([sem("2026-01-04", "6.01"), sem("2026-01-11", "6.02"), sem("2026-01-18", "6.02")], { hoje: HOJE }); // 6,016666…
  const n = mediasMensais([sem("2026-01-04", "6.00", "N")], { hoje: HOJE });
  assert.equal(mediaCombinada(ne, n)[0].preco_medio, "6.008333"); // (6,0166666…+6)/2 = 6,0083333…
});

const mes = (ano, m, preco, completo = true) => ({ ano, mes: m, preco_medio: preco, mes_completo: completo, n_semanas: 4 });
const M1 = { id: 1, ref_ano: 2026, ref_mes: 1, preco_referencia: "6.000000" };

test("diferença e variação mensal (R$ e %) somente entre meses consecutivos", () => {
  const s = serieIndicador([mes(2026, 1, "6.000000"), mes(2026, 2, "6.150000"), mes(2026, 4, "6.300000")], [M1]);
  assert.equal(s[0].diferenca_mensal, null);
  assert.equal(s[1].diferenca_mensal, "0.150000");
  assert.equal(s[1].variacao_mensal_pct, "2.5000");
  assert.equal(s[2].variacao_mensal_pct, null); // março ausente: não compara com fevereiro
});

test("variação acumulada é razão contra o marco — NÃO soma de percentuais mensais", () => {
  const s = serieIndicador([mes(2026, 1, "6.000000"), mes(2026, 2, "6.150000"), mes(2026, 3, "6.300000")], [M1]);
  const soma = Number(s[1].variacao_mensal_pct) + Number(s[2].variacao_mensal_pct); // 2,5 + 2,4390 = 4,939
  assert.equal(s[2].variacao_acumulada_pct, "5.0000");
  assert.notEqual(soma.toFixed(4), s[2].variacao_acumulada_pct);
  assert.equal(s[2].diferenca_acumulada, "0.300000");
  assert.equal(s[0].variacao_acumulada_pct, "0.0000");
  assert.equal(s[0].marco_inicia_aqui, true);
});

test("gatilho inclusivo: +5% e −5% exatos disparam; acima/abaixo disparam; entre não", () => {
  const casos = [["6.300000", "ALTA"], ["6.360000", "ALTA"], ["5.700000", "BAIXA"], ["5.640000", "BAIXA"], ["6.299999", "SEM_GATILHO"], ["5.700001", "SEM_GATILHO"], ["6.000000", "SEM_GATILHO"]];
  for (const [preco, esperado] of casos) {
    const [, row] = serieIndicador([mes(2026, 1, "6.000000"), mes(2026, 2, preco)], [M1]);
    assert.equal(row.gatilho, esperado, `preço ${preco}`);
  }
});

test("novo marco reinicia o acumulado a partir do seu mês; meses anteriores mantêm o marco antigo", () => {
  const marcos = [M1, { id: 2, ref_ano: 2026, ref_mes: 3, preco_referencia: "7.000000" }];
  const s = serieIndicador([mes(2026, 1, "6.000000"), mes(2026, 2, "6.600000"), mes(2026, 3, "7.000000"), mes(2026, 4, "7.350000")], marcos);
  assert.equal(s[1].marco_id, 1); assert.equal(s[1].variacao_acumulada_pct, "10.0000");
  assert.equal(s[2].marco_id, 2); assert.equal(s[2].variacao_acumulada_pct, "0.0000"); assert.equal(s[2].marco_inicia_aqui, true);
  assert.equal(s[3].variacao_acumulada_pct, "5.0000"); assert.equal(s[3].diferenca_acumulada, "0.350000"); assert.equal(s[3].gatilho, "ALTA");
});

test("marco aplicável: o de referência mais recente ≤ mês (no mesmo mês, o de maior id)", () => {
  const marcos = [M1, { id: 2, ref_ano: 2026, ref_mes: 3, preco_referencia: "7" }, { id: 3, ref_ano: 2026, ref_mes: 1, preco_referencia: "6.1" }];
  assert.equal(marcoDoMes(marcos, 2026, 2).id, 3);
  assert.equal(marcoDoMes(marcos, 2026, 5).id, 2);
  assert.equal(marcoDoMes([M1], 2025, 12), null);
});

test("cadeia de marcos automáticos: o mês que passa de ±5% vira o novo marco (dados da planilha NE/NO 2026)", () => {
  const precos = ["6.1488", "6.1400", "7.1670", "7.5438", "7.3390", "7.2538", "7.1588", "7.1270", "7.3838", "7.4700", "7.4300"];
  const meses = precos.map((p, i) => ({ ...mes(2026, i + 1, p), mes_completo: i < 10 }));
  const cadeia = cadeiaMarcosAutomaticos(meses, [{ id: 1, ref_ano: 2026, ref_mes: 1, preco_referencia: "6.1488" }], 5);
  assert.deepEqual(cadeia.map((c) => [c.ref_mes, c.direcao, c.variacao_pct]), [[3, "ALTA", "16.5593"], [4, "ALTA", "5.2574"], [7, "BAIXA", "-5.1035"]]);
  assert.deepEqual(cadeia[1].anterior, { ref_ano: 2026, ref_mes: 3, preco_referencia: "7.1670" });
  // âncora manual em junho reinicia a cadeia: julho fica −1,31% sobre junho (sem marco)
  const comAncora = cadeiaMarcosAutomaticos(meses, [{ id: 1, ref_ano: 2026, ref_mes: 1, preco_referencia: "6.1488" }, { id: 9, ref_ano: 2026, ref_mes: 6, preco_referencia: "7.2538" }], 5);
  assert.deepEqual(comAncora.map((c) => c.ref_mes), [3, 4]);
});

test("detecção: primeiro mês que atinge cada gatilho após o marco (o mês do marco nunca dispara)", () => {
  const s = serieIndicador([mes(2026, 1, "6.0"), mes(2026, 2, "6.1"), mes(2026, 3, "6.3"), mes(2026, 4, "6.5"), mes(2026, 5, "5.6")], [M1]);
  const d = detectarGatilhos(s, M1);
  assert.equal(d.ALTA.mes, 3);   // exatamente +5% em março
  assert.equal(d.BAIXA.mes, 5);  // −6,67% em maio
});

test("indicadores individuais NE e NO usam o mesmo mês de marco com o preço da própria região", () => {
  const ne = [mes(2026, 1, "6.000000"), mes(2026, 2, "6.300000")];
  const r = marcosParaRegiao([{ ...M1, preco_referencia: "6.100000" }], ne);
  assert.equal(r[0].preco_referencia, "6.000000");
  assert.equal(serieIndicador(ne, r)[1].variacao_acumulada_pct, "5.0000");
});

test("distância até os gatilhos", () => {
  const d = distanciaGatilhos("6.150000", "6.000000", 5);
  assert.equal(d.variacao_pct, "2.5000");
  assert.equal(d.diferenca_rs, "0.150000");
  assert.equal(d.restante_alta_pp, "2.5000");
  assert.equal(d.restante_baixa_pp, "7.5000");
  assert.equal(d.preco_gatilho_alta, "6.300000");
  assert.equal(d.preco_gatilho_baixa, "5.700000");
});

test("tabela no formato da planilha: BA, NE, NO, NE/NO + 4 linhas de cálculo, JAN..DEZ + ACUM, sem meses futuros inventados", () => {
  const neno = serieIndicador([mes(2026, 1, "6.148750"), mes(2026, 2, "6.140000"), mes(2026, 3, "7.167000", false)], [{ ...M1, preco_referencia: "6.148750" }]);
  const ne = serieIndicador([mes(2026, 1, "6.032500"), mes(2026, 2, "6.007500"), mes(2026, 3, "7.074000", false)]);
  const n = serieIndicador([mes(2026, 1, "6.265000"), mes(2026, 2, "6.272500"), mes(2026, 3, "7.260000", false)]);
  const ba = serieIndicador([mes(2026, 1, "6.257500"), mes(2026, 2, "6.240000"), mes(2026, 3, "7.320000", false)]);
  const t = tabelaPlanilha({ NENO: neno, BA: ba, NE: ne, N: n }, 2026);
  assert.deepEqual(Object.keys(t.linhas), ["preco_ba", "preco_ne", "preco_no", "preco_neno", "variacao_mensal_pct", "diferenca_mensal", "variacao_acumulada_pct", "diferenca_acumulada"]);
  assert.equal(t.linhas.preco_ba.valores[0].valor, "6.257500");     // BA vem da própria série (≠ NE/NO 6,14875)
  assert.equal(t.linhas.preco_ba.valores[2].parcial, true);
  assert.equal(t.meses.length, 12);
  assert.equal(t.linhas.preco_ne.valores[0].valor, "6.032500");
  assert.equal(t.linhas.preco_neno.valores[2].parcial, true);
  assert.equal(t.linhas.preco_neno.valores[3], null);               // abril: sem dados → vazio
  assert.equal(t.linhas.variacao_mensal_pct.valores[0], null);      // jan/2026 sem dez/2025
  assert.equal(t.linhas.variacao_mensal_pct.valores[2], "16.7264");  // 7,167 / 6,14 − 1 (dado real)
  assert.equal(t.linhas.diferenca_mensal.valores[2], "1.027000");
  assert.equal(t.linhas.variacao_acumulada_pct.valores[2], "16.5603"); // 7,167 / 6,14875 − 1 (dado real)
  assert.equal(t.linhas.diferenca_acumulada.valores[2], "1.018250");
  assert.equal(t.linhas.variacao_acumulada_pct.acum, "16.5603");
  assert.equal(t.linhas.variacao_mensal_pct.acum, "16.5603");        // do 1º mês do ano ao último (sem dez anterior)
  assert.equal(t.linhas.preco_neno.acum, "6.485250");                // média dos 3 meses
  assert.deepEqual(t.marcos_no_ano.slice(0, 3), [true, false, false]);
});

test("tabela com base individual (NE) nas linhas 4–7", () => {
  const ne = serieIndicador([mes(2026, 1, "6.000000"), mes(2026, 2, "6.300000")], [M1]);
  const t = tabelaPlanilha({ NENO: [], NE: ne, N: [] }, 2026, "NE");
  assert.equal(t.base, "NE");
  assert.equal(t.linhas.variacao_acumulada_pct.valores[1], "5.0000");
});

test("tabela com base BA: variações e diferenças calculadas só com os preços da Bahia", () => {
  const marcoBA = { ...M1, preco_referencia: "6.200000" };
  const ba = serieIndicador([mes(2026, 1, "6.200000"), mes(2026, 2, "6.510000")], [marcoBA]);
  const neno = serieIndicador([mes(2026, 1, "6.000000"), mes(2026, 2, "6.050000")], [M1]);
  const t = tabelaPlanilha({ NENO: neno, BA: ba, NE: [], N: [] }, 2026, "BA");
  assert.equal(t.base, "BA");
  assert.equal(t.linhas.variacao_mensal_pct.valores[1], "5.0000");   // 6,51 / 6,20 − 1
  assert.equal(t.linhas.diferenca_mensal.valores[1], "0.310000");
  assert.equal(t.linhas.variacao_acumulada_pct.valores[1], "5.0000");
  assert.equal(t.linhas.preco_neno.valores[1].valor, "6.050000");   // linha NE/NO intacta
});
