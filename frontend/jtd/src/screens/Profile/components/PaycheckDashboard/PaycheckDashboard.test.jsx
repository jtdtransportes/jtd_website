import { fireEvent, render, screen } from "@testing-library/react";
import PaycheckDashboard from "./PaycheckDashboard";

function paycheck(overrides = {}) {
  return {
    id: 1,
    user_id: 1,
    ano: 2026,
    mes: 7,
    is_active: 1,
    user_nome: "Ana Souza",
    user_email: "ana@empresa.com",
    user_cpf: "12345678901",
    sector_name: "Financeiro",
    user_is_active: 1,
    ...overrides,
  };
}

describe("PaycheckDashboard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 15, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("mostra e filtra quem tinha documento no mês anterior", () => {
    render(
      <PaycheckDashboard
        paychecks={[
          paycheck(),
          paycheck({
            id: 2,
            user_id: 2,
            user_nome: "Bia Lima",
            user_email: "bia@empresa.com",
            user_cpf: "98765432100",
            sector_name: "Operações",
            user_is_active: 0,
          }),
          paycheck({ id: 3, ano: 2026, mes: 8 }),
          paycheck({
            id: 4,
            user_id: 3,
            ano: 2026,
            mes: 8,
            user_nome: "Caio Alves",
          }),
        ]}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Faltantes em agosto de 2026" })
    ).toBeInTheDocument();
    expect(screen.getByText("Bia Lima")).toBeInTheDocument();
    expect(screen.getByText("Conta inativa")).toBeInTheDocument();
    expect(screen.getByText("1 de 1 encontrados")).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Status da conta" }),
      { target: { value: "active" } }
    );

    expect(screen.queryByText("Bia Lima")).not.toBeInTheDocument();
    expect(screen.getByText("0 de 1 encontrados")).toBeInTheDocument();
  });

  test("troca a competência pela barra mensal e explicita quando não há base", () => {
    render(<PaycheckDashboard paychecks={[paycheck()]} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /julho de 2026: 1 contracheques; sem base no mês anterior/i,
      })
    );

    expect(
      screen.getByRole("combobox", { name: "Competência analisada" })
    ).toHaveValue("2026-07");
    expect(
      screen.getByText(/Não há contracheques em junho de 2026 para formar uma base/i)
    ).toBeInTheDocument();
  });

  test("exibe um estado de carregamento sem apresentar números antigos", () => {
    render(<PaycheckDashboard paychecks={[paycheck()]} loading />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Carregando indicadores de contracheques"
    );
    expect(screen.queryByText("Total no site")).not.toBeInTheDocument();
  });

  test("oculta os indicadores quando a atualização dos dados falha", () => {
    render(
      <PaycheckDashboard
        paychecks={[paycheck()]}
        error="Serviço temporariamente indisponível."
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível atualizar o dashboard de contracheques"
    );
    expect(screen.queryByText("Total no site")).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Competência analisada" })
    ).toBeDisabled();
  });

  test("avisa e permite filtrar contas cujo status não foi carregado", () => {
    render(
      <PaycheckDashboard
        paychecks={[
          paycheck({ user_is_active: undefined }),
        ]}
        accountStatusError="Erro ao carregar usuários."
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Não foi possível atualizar o status das contas"
    );

    const statusFilter = screen.getByRole("combobox", {
      name: "Status da conta",
    });
    fireEvent.change(statusFilter, { target: { value: "unknown" } });

    expect(statusFilter).toHaveValue("unknown");
    expect(screen.getByText("Status não informado")).toBeInTheDocument();
  });
});
