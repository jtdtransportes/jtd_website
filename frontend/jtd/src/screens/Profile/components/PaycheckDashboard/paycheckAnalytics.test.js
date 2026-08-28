import {
  buildPaycheckAnalytics,
  createContinuousMonthRange,
  createMonthKey,
  shiftMonthKey,
} from "./paycheckAnalytics";

function paycheck(overrides = {}) {
  return {
    id: 1,
    user_id: 10,
    ano: 2026,
    mes: 8,
    is_active: 1,
    user_nome: "Ana Souza",
    email: "ana@empresa.com",
    cpf: "12345678901",
    sector_name: "Financeiro",
    user_is_active: 1,
    ...overrides,
  };
}

describe("paycheckAnalytics", () => {
  test("faz a virada de janeiro para dezembro do ano anterior", () => {
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");

    const result = buildPaycheckAnalytics(
      [
        paycheck({ ano: 2025, mes: 12, user_id: 10 }),
        paycheck({ id: 2, ano: 2026, mes: 1, user_id: 10 }),
      ],
      { selectedMonth: "2026-01", referenceMonth: "2026-01" }
    );

    expect(result.comparison.previousMonth).toBe("2025-12");
    expect(result.comparison.maintainedCount).toBe(1);
    expect(result.comparison.missingCount).toBe(0);
  });

  test("gera doze meses contínuos e inclui competências sem documentos", () => {
    expect(createContinuousMonthRange("2026-08", 12)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);

    const result = buildPaycheckAnalytics([], {
      selectedMonth: "2026-08",
      referenceMonth: "2026-08",
    });

    expect(result.series).toHaveLength(12);
    expect(result.series.every((month) => month.documentCount === 0)).toBe(true);
  });

  test("conta linhas duplicadas, mas usa presença única por usuário", () => {
    const result = buildPaycheckAnalytics(
      [
        paycheck({ id: 1, ano: 2026, mes: 7, user_id: 10 }),
        paycheck({ id: 2, ano: 2026, mes: 8, user_id: 10 }),
        paycheck({ id: 3, ano: 2026, mes: 8, user_id: 10 }),
      ],
      { selectedMonth: "2026-08", referenceMonth: "2026-08" }
    );

    expect(result.totalDocuments).toBe(3);
    expect(result.selectedDocumentCount).toBe(2);
    expect(result.comparison.currentUserCount).toBe(1);
    expect(result.comparison.maintainedCount).toBe(1);
    expect(result.comparison.newCount).toBe(0);
    expect(result.comparison.missingCount).toBe(0);
    expect(result.comparison.coverage).toBe(100);
  });

  test("ignora documentos inativos sem ocultar conta inativa da lista de faltantes", () => {
    const result = buildPaycheckAnalytics(
      [
        paycheck({
          id: 1,
          ano: 2026,
          mes: 7,
          user_id: 20,
          user_nome: "Bruno Lima",
          user_is_active: 0,
        }),
        paycheck({
          id: 2,
          ano: 2026,
          mes: 8,
          user_id: 20,
          is_active: 0,
          user_is_active: 0,
        }),
      ],
      { selectedMonth: "2026-08", referenceMonth: "2026-08" }
    );

    expect(result.totalDocuments).toBe(1);
    expect(result.storedDocuments).toBe(2);
    expect(result.inactiveDocuments).toBe(1);
    expect(result.selectedDocumentCount).toBe(0);
    expect(result.comparison.missingCount).toBe(1);
    expect(result.comparison.missingUsers[0]).toMatchObject({
      userId: "20",
      nome: "Bruno Lima",
      accountStatus: "inactive",
    });
  });

  test("ignora registros com competência ou usuário inválidos", () => {
    const result = buildPaycheckAnalytics(
      [
        paycheck({ id: 1, mes: 13 }),
        paycheck({ id: 2, ano: "inválido" }),
        paycheck({ id: 3, user_id: "" }),
        paycheck({ id: 4, mes: 8, user_id: 40 }),
      ],
      { selectedMonth: "2026-08", referenceMonth: "2026-08" }
    );

    expect(createMonthKey(2026, 13)).toBe("");
    expect(result.totalDocuments).toBe(1);
    expect(result.selectedDocumentCount).toBe(1);
    expect(result.comparison.newCount).toBe(1);
  });

  test("separa mantidos, novos e faltantes e calcula cobertura sobre a base anterior", () => {
    const result = buildPaycheckAnalytics(
      [
        paycheck({ id: 1, ano: 2026, mes: 7, user_id: 1, user_nome: "Ana" }),
        paycheck({ id: 2, ano: 2026, mes: 7, user_id: 2, user_nome: "Bia" }),
        paycheck({ id: 3, ano: 2026, mes: 8, user_id: 1, user_nome: "Ana" }),
        paycheck({ id: 4, ano: 2026, mes: 8, user_id: 3, user_nome: "Caio" }),
      ],
      { selectedMonth: "2026-08", referenceMonth: "2026-08" }
    );

    expect(result.comparison).toMatchObject({
      previousUserCount: 2,
      currentUserCount: 2,
      maintainedCount: 1,
      newCount: 1,
      missingCount: 1,
      coverage: 50,
    });
    expect(result.comparison.missingUsers.map((user) => user.nome)).toEqual([
      "Bia",
    ]);
  });

  test("aceita entrada vazia e preserva metadados ausentes com valores seguros", () => {
    const emptyResult = buildPaycheckAnalytics(null, {
      selectedMonth: "2026-08",
      referenceMonth: "2026-08",
    });
    const result = buildPaycheckAnalytics(
      [
        paycheck({
          ano: 2026,
          mes: 7,
          user_id: "00010",
          email: undefined,
          user_email: undefined,
          cpf: undefined,
          user_cpf: undefined,
        }),
      ],
      { selectedMonth: "2026-08", referenceMonth: "2026-08" }
    );

    expect(emptyResult.totalDocuments).toBe(0);
    expect(result.comparison.missingUsers[0]).toMatchObject({
      userId: "10",
      email: "",
      cpf: "",
    });
  });

  test("normaliza IDs numéricos sem perder precisão", () => {
    const largeUserId = "900719925474099312345";
    const result = buildPaycheckAnalytics(
      [
        paycheck({ ano: 2026, mes: 7, user_id: largeUserId }),
        paycheck({ id: 2, ano: 2026, mes: 8, user_id: largeUserId }),
      ],
      { selectedMonth: "2026-08", referenceMonth: "2026-08" }
    );

    expect(result.comparison.maintainedUsers[0].userId).toBe(largeUserId);
    expect(result.comparison.missingCount).toBe(0);
  });
});
