import { fmtBRL, fmtDifRs, fmtPct, rotuloMes, textoGatilho } from "./format";

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
