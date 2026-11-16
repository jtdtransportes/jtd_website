import { fmtDataBr, fmtPercentual, mesPorExtenso, montarModelo, normalizarPercentual, textoDe } from "./modelo";

test("percentual: aceita vírgula/ponto/%, recusa valores inválidos", () => {
  expect(normalizarPercentual("8,5")).toBe("8.5");
  expect(normalizarPercentual("8.50%")).toBe("8.5");
  expect(normalizarPercentual("5.2900")).toBe("5.29");
  expect(normalizarPercentual("")).toBeNull();
  expect(normalizarPercentual("0")).toBeUndefined();
  expect(normalizarPercentual("abc")).toBeUndefined();
  expect(normalizarPercentual("150")).toBeUndefined();
  expect(fmtPercentual("5.29")).toBe("5,29%");
  expect(fmtPercentual("10")).toBe("10%");
  expect(fmtDataBr("2026-12-01")).toBe("01/12/2026");
  expect(mesPorExtenso({ ano: 2026, mes: 11 })).toBe("novembro de 2026");
  expect(mesPorExtenso(null)).toBe("");
});

test("modelo com todos os dados: comunica o reajuste acumulado do mês (sem 'propomos')", () => {
  const html = montarModelo({ cliente: "Alfa Ltda", contato: "Carlos", percentual: "5.29", vigencia: "2026-12-01", contrato: "CT-15", referencia: "novembro de 2026" });
  expect(html).toContain("<strong>Alfa Ltda</strong><br>A/C: Carlos");
  expect(html).toContain("Prezado(a) Carlos,");
  expect(html).toContain("comunicar o reajuste dos valores de frete praticados no âmbito do contrato <strong>CT-15</strong>");
  expect(html).toContain("o reajuste acumulado do óleo diesel S10 atingiu <strong>5,29%</strong> em novembro de 2026.");
  expect(html).toContain("esse percentual será aplicado aos valores atualmente praticados, a partir de <strong>01/12/2026</strong>.");
  expect(textoDe(html)).not.toMatch(/propomos|proposta|solicitamos a avaliação/i);
});

test("modelo sem dados opcionais: adapta o texto, sem variáveis vazias nem valores inventados", () => {
  const texto = textoDe(montarModelo({ cliente: "Alfa Ltda" }));
  expect(texto).toContain("Prezados(as),");
  expect(texto).toContain("em nossa prestação de serviços de transporte");
  expect(texto).toContain("serão reajustados conforme o acumulado do óleo diesel S10.");
  expect(texto).not.toMatch(/%|undefined|null|\{|\}|A\/C|propomos/);
  expect(montarModelo({ percentual: "5" })).toContain("atingiu <strong>5%</strong>. Dessa forma, esse percentual será aplicado aos valores atualmente praticados.");
  expect(montarModelo({ referencia: "novembro de 2026" })).toContain("conforme o acumulado do óleo diesel S10 apurado em novembro de 2026.");
  expect(montarModelo({ vigencia: "2027-01-01" })).toContain("conforme o acumulado do óleo diesel S10, a partir de <strong>01/01/2027</strong>.");
});

test("modelo escapa nomes com HTML", () => {
  const html = montarModelo({ cliente: "<script>x</script>", contato: "A & B" });
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("A &amp; B");
});
