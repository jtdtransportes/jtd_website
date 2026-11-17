// Tabela mensal: linha "Variação desde o marco", rótulos curtos (celular) e visualização em tela cheia.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PlanilhaMensal } from "./AnttGatilhos";

jest.mock("../../services/anttService", () => ({ anttApi: {} }));

const meses = (f) => Array.from({ length: 12 }, (_, i) => f(i + 1));
const PRECOS = { 1: "6.1487", 2: "6.1400", 3: "7.1670", 4: "7.5438", 5: "7.3390", 6: "7.2538", 7: "7.1588" };
const preco = () => ({ valores: meses((m) => (PRECOS[m] ? { valor: PRECOS[m], parcial: false } : null)), acum: "7.0000" });
const TABELA = {
  ano: 2026, base: "NENO",
  linhas: {
    preco_ba: preco(), preco_ne: preco(), preco_no: preco(), preco_neno: preco(),
    variacao_mensal_pct: { valores: meses((m) => (m > 1 && PRECOS[m] ? "1.0000" : null)), acum: "16.4300" },
    variacao_acumulada_pct: { valores: meses((m) => ({ 2: "-0.1423", 5: "-2.7142", 6: "-3.8442" })[m] ?? (PRECOS[m] ? "0.0000" : null)), acum: "0.0000" },
  },
};
// marcos: jan (inicial), mar, abr e jul (jul caiu −5,10% contra abr)
const ref = { 1: [2026, 1, "6.1487"], 3: [2026, 3, "7.1670"], 4: [2026, 4, "7.5438"], 7: [2026, 7, "7.1588"] };
let atual = null;
const SERIE = Object.keys(PRECOS).map(Number).map((m) => {
  if (ref[m]) atual = { ano: ref[m][0], mes: ref[m][1], preco: ref[m][2] };
  return { ano: 2026, mes: m, preco_medio: PRECOS[m], marco_ref: atual, marco_inicia_aqui: Boolean(ref[m]) };
});

test("linha 'Variação desde o marco' mostra o motivo de cada marco (◆) e o rótulo curto para celular", () => {
  render(<PlanilhaMensal tabela={TABELA} serie={SERIE} />);
  const linha = screen.getByText("Desde o marco %").closest("tr");
  expect(within(linha).getByText("◆ inicial")).toBeInTheDocument();
  expect(within(linha).getByText("+16,56% ◆")).toBeInTheDocument();
  expect(within(linha).getByText("+5,26% ◆")).toBeInTheDocument();
  expect(within(linha).getByText("-5,10% ◆")).toBeInTheDocument();
  expect(within(linha).getByText("-3,84%")).toBeInTheDocument();
  expect(within(linha).getByText("Desde o marco %")).toBeInTheDocument();       // versão curta (celular)
  expect(screen.getAllByText("NE/NO").length).toBeGreaterThan(0);
  expect(screen.getByText(/É este o número comparado com o gatilho/)).toBeInTheDocument();
});

test("'Ver tabela inteira' abre a tabela em tela cheia com zoom e fecha", () => {
  render(<PlanilhaMensal tabela={TABELA} serie={SERIE} />);
  fireEvent.click(screen.getByRole("button", { name: /Ver tabela inteira/ }));
  const dialogo = screen.getByRole("dialog", { name: /Tabela mensal ANP/ });
  expect(within(dialogo).getByText("-5,10% ◆")).toBeInTheDocument();
  expect(within(dialogo).getByText("100%")).toBeInTheDocument();
  fireEvent.click(within(dialogo).getByRole("button", { name: "Aumentar zoom" }));
  expect(within(dialogo).getByText("110%")).toBeInTheDocument();
  fireEvent.click(within(dialogo).getByRole("button", { name: "Fechar tabela em tela cheia" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("títulos das linhas usam o símbolo 𝑀𝑎 no lugar de 'Média'", () => {
  render(<PlanilhaMensal tabela={TABELA} serie={SERIE} />);
  const linha = screen.getByText("Desde o marco %").closest("tr");
  expect(within(linha).getByRole("rowheader").textContent).toContain("Variação desde o marco — Ma NE/NO (%)");
  expect(within(linha).getByRole("rowheader").textContent).not.toContain("Média");
  expect(screen.getAllByTitle("Média").length).toBeGreaterThanOrEqual(2);
});
