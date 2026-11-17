import { contaVariacao, descreverVariacao, fmtBRL, fmtDifRs, fmtPct, rotuloMes, textoGatilho } from "./format";

test("acumulado sempre descrito: o que é o número, de que mês e contra qual marco, com a conta", () => {
  expect(descreverVariacao({ indicador: "NENO", ano: 2026, mes: 11, parcial: true, marco: { ano: 2026, mes: 7 } }))
    .toBe("Variação acumulada da média NE/NO do Diesel S10 em novembro/2026 (mês em andamento) em relação ao marco de julho/2026");
  expect(descreverVariacao({ indicador: "BA", ano: 2026, mes: 10, marco: { ano: 2026, mes: 7 } }))
    .toBe("Variação acumulada do preço médio do Diesel S10 na Bahia em outubro/2026 em relação ao marco de julho/2026");
  expect(contaVariacao("7.422500", "7.158750", "3.6843")).toBe("(7,4225 ÷ 7,1588 − 1) × 100 = +3,68%");
  expect(contaVariacao(null, "7.1", "1")).toBe("");
});

test("formatação em R$ e % no padrão brasileiro", () => {
  expect(fmtBRL("7.167", 4)).toBe("R$ 7,1670");
  expect(fmtDifRs("1.01825")).toBe("+R$ 1,0183");
  expect(fmtDifRs("-0.04")).toBe("-R$ 0,0400");
  expect(fmtPct("16.5603")).toBe("+16,56%");
  expect(fmtPct("-0.5355")).toBe("-0,54%");
  expect(fmtPct(null)).toBe("—");
  expect(rotuloMes(2026, 3)).toBe("MAR/26");
});

test("texto do gatilho reflete a regra inclusiva (≥ / ≤)", () => {
  expect(textoGatilho("ALTA", 5)).toBe("Gatilho de aumento (≥ +5%)");
  expect(textoGatilho("BAIXA", 5)).toBe("Gatilho de redução (≤ -5%)");
  expect(textoGatilho("SEM_GATILHO", 5)).toBe("Sem gatilho");
});

test("exibição principal com 2 casas: R$ 7,42 · +R$ 0,26/L · -R$ 0,05/L · +3,68%; valor completo só no detalhe", () => {
  const { fmtRsL, completo } = require("./format");
  expect(fmtBRL("7.422500")).toBe("R$ 7,42");
  expect(fmtRsL("0.2600")).toBe("+R$ 0,26/L");
  expect(fmtRsL("-0.0475")).toBe("-R$ 0,05/L");
  expect(fmtPct("3.6750")).toBe("+3,68%");
  expect(fmtPct("-0.6400")).toBe("-0,64%");
  expect(completo("7.422500", " R$/L")).toBe("7,422500 R$/L");
  expect(fmtRsL(null)).toBe("—");
});
