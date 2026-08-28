import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  buildPaycheckAnalytics,
  getCurrentMonthKey,
  parseMonthKey,
} from "./paycheckAnalytics";
import "./PaycheckDashboard.css";

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const MONTH_NAMES_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function formatMonth(monthKey, short = false) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return "Competência inválida";

  if (short) {
    return `${MONTH_NAMES_SHORT[parsed.month - 1]}/${String(parsed.year).slice(-2)}`;
  }

  return `${MONTH_NAMES[parsed.month - 1]} de ${parsed.year}`;
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";

  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCpf(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "CPF não informado";

  let digits = rawValue.replace(/\D/g, "");
  if (digits.length === 10) digits = digits.padStart(11, "0");

  if (digits.length !== 11) return rawValue;

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

function getAccountStatusLabel(status) {
  if (status === "active") return "Conta ativa";
  if (status === "inactive") return "Conta inativa";
  return "Status não informado";
}

function getBarHeight(value, maximum) {
  if (!value || !maximum) return 0;
  return Math.max(10, Math.round((Number(value) / Number(maximum)) * 100));
}

export default function PaycheckDashboard({
  paychecks = [],
  loading = false,
  error = "",
  accountStatusError = "",
  onUploadMissingPaycheck,
}) {
  const componentId = useId();
  const chartScrollRef = useRef(null);
  const currentMonth = useMemo(() => getCurrentMonthKey(), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [uploadingMissingUserIds, setUploadingMissingUserIds] = useState([]);

  const analytics = useMemo(
    () =>
      buildPaycheckAnalytics(paychecks, {
        selectedMonth,
        referenceMonth: currentMonth,
      }),
    [currentMonth, paychecks, selectedMonth]
  );

  useEffect(() => {
    if (loading || error) return;

    const chartScroller = chartScrollRef.current;
    const selectedBar = chartScroller?.querySelector(
      '[aria-pressed="true"]'
    );

    if (chartScroller && selectedBar) {
      chartScroller.scrollLeft = Math.max(
        0,
        selectedBar.offsetLeft -
          (chartScroller.clientWidth - selectedBar.offsetWidth) / 2
      );
    }
  }, [analytics.selectedMonth, error, loading]);

  const filteredMissingUsers = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search);

    return analytics.comparison.missingUsers.filter((user) => {
      if (accountFilter !== "all" && user.accountStatus !== accountFilter) {
        return false;
      }

      if (!normalizedSearch) return true;

      const searchableText = normalizeSearchText(
        [user.nome, user.email, user.cpf, formatCpf(user.cpf), user.sectorName].join(
          " "
        )
      );

      return searchableText.includes(normalizedSearch);
    });
  }, [accountFilter, analytics.comparison.missingUsers, search]);

  const maxDocumentCount = Math.max(
    1,
    ...analytics.series.map((month) => month.documentCount)
  );
  const selectedMonthLabel = formatMonth(analytics.selectedMonth);
  const previousMonthLabel = formatMonth(analytics.comparison.previousMonth);
  const hasComparisonBase = analytics.comparison.previousUserCount > 0;
  const hasMissingUsers = analytics.comparison.missingCount > 0;
  const coverage = analytics.comparison.coverage;
  const canUploadMissingPaycheck =
    typeof onUploadMissingPaycheck === "function";

  async function handleMissingPaycheckFileChange(event, missingUser) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file || !canUploadMissingPaycheck) return;

    const parsedMonth = parseMonthKey(analytics.selectedMonth);
    if (!parsedMonth) return;

    setUploadingMissingUserIds((prev) => [...prev, missingUser.userId]);

    try {
      await onUploadMissingPaycheck({
        user: missingUser,
        file,
        ano: parsedMonth.year,
        mes: parsedMonth.month,
        monthKey: analytics.selectedMonth,
      });
    } finally {
      setUploadingMissingUserIds((prev) =>
        prev.filter((userId) => userId !== missingUser.userId)
      );
    }
  }

  return (
    <section
      className="paycheck-dashboard"
      aria-labelledby={`${componentId}-title`}
      aria-busy={loading}
    >
      <header className="paycheck-dashboard-header">
        <div>
          <span className="paycheck-dashboard-eyebrow">Acompanhamento mensal</span>
          <h4 id={`${componentId}-title`}>Contracheques</h4>
          <p>
            Acompanhe os documentos disponíveis e identifique quem estava no mês
            anterior e ainda não aparece na competência selecionada.
          </p>
        </div>

        <label className="paycheck-dashboard-competence-select">
          <span>Competência analisada</span>
          <select
            value={analytics.selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            disabled={loading || Boolean(error)}
          >
            {[...analytics.series].reverse().map((month) => (
              <option key={month.month} value={month.month}>
                {formatMonth(month.month)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading ? (
        <div className="paycheck-dashboard-loading" role="status">
          <span className="paycheck-dashboard-loading-indicator" aria-hidden="true" />
          <span>Carregando indicadores de contracheques...</span>
        </div>
      ) : error ? (
        <div className="paycheck-dashboard-error" role="alert">
          <strong>Não foi possível atualizar o dashboard de contracheques.</strong>
          <span>{error}</span>
          <small>
            Os números foram ocultados para evitar uma análise com dados antigos ou
            incompletos. Tente abrir o Dashboard novamente.
          </small>
        </div>
      ) : (
        <>
          <div className="paycheck-dashboard-metrics">
            <article className="paycheck-dashboard-metric">
              <span>Total no site</span>
              <strong>{formatNumber(analytics.storedDocuments)}</strong>
              <small>
                {formatNumber(analytics.totalDocuments)} disponíveis
                {analytics.inactiveDocuments > 0
                  ? ` · ${formatNumber(analytics.inactiveDocuments)} inativos`
                  : ""}
              </small>
            </article>

            <article className="paycheck-dashboard-metric">
              <span>Em {formatMonth(analytics.selectedMonth, true)}</span>
              <strong>{formatNumber(analytics.selectedDocumentCount)}</strong>
              <small>documentos enviados</small>
            </article>

            <article
              className={`paycheck-dashboard-metric ${
                hasMissingUsers ? "paycheck-dashboard-metric-alert" : ""
              }`}
            >
              <span>Faltando no mês</span>
              <strong>
                {hasComparisonBase
                  ? formatNumber(analytics.comparison.missingCount)
                  : "—"}
              </strong>
              <small>
                {hasComparisonBase
                  ? `em relação a ${formatMonth(
                      analytics.comparison.previousMonth,
                      true
                    )}`
                  : `sem base em ${formatMonth(
                      analytics.comparison.previousMonth,
                      true
                    )}`}
              </small>
            </article>

            <article className="paycheck-dashboard-metric">
              <span>Cobertura da base anterior</span>
              <strong>{formatPercent(coverage)}</strong>
              <small>
                {hasComparisonBase
                  ? `${formatNumber(analytics.comparison.maintainedCount)} de ${formatNumber(
                      analytics.comparison.previousUserCount
                    )} colaboradores`
                  : "sem base no mês anterior"}
              </small>
            </article>
          </div>

          <section
            className="paycheck-dashboard-panel paycheck-dashboard-chart-panel"
            aria-labelledby={`${componentId}-chart-title`}
          >
            <div className="paycheck-dashboard-panel-header">
              <div>
                <h5 id={`${componentId}-chart-title`}>Contracheques por competência</h5>
                <p>Selecione uma barra para comparar com o mês imediatamente anterior.</p>
              </div>
              <span>Últimos 12 meses</span>
            </div>

            <div
              className="paycheck-dashboard-chart-legend"
              aria-label="Legenda do gráfico"
            >
              <span>
                <i className="documents" aria-hidden="true" />
                Documentos disponíveis
              </span>
              <span>
                <i className="missing" aria-hidden="true" />
                Faltantes em relação ao mês anterior
              </span>
            </div>

            <div
              className="paycheck-dashboard-chart-scroll"
              ref={chartScrollRef}
            >
              <div
                className="paycheck-dashboard-chart"
                role="group"
                aria-label="Quantidade mensal de contracheques"
              >
                {analytics.series.map((month) => {
                  const isSelected = month.month === analytics.selectedMonth;
                  const hasMonthMissing = month.missingFromPreviousCount > 0;
                  const hasMonthBase = month.coverage !== null;

                  return (
                    <button
                      className={`paycheck-dashboard-bar ${
                        isSelected ? "paycheck-dashboard-bar-selected" : ""
                      } ${hasMonthMissing ? "paycheck-dashboard-bar-warning" : ""}`}
                      key={month.month}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${formatMonth(month.month)}: ${formatNumber(
                        month.documentCount
                      )} contracheques; ${
                        hasMonthBase
                          ? `${formatNumber(
                              month.missingFromPreviousCount
                            )} faltantes em relação ao mês anterior`
                          : "sem base no mês anterior"
                      }`}
                      onClick={() => setSelectedMonth(month.month)}
                    >
                      <span className="paycheck-dashboard-bar-value">
                        {formatNumber(month.documentCount)}
                      </span>
                      <span className="paycheck-dashboard-bar-track" aria-hidden="true">
                        <span
                          className="paycheck-dashboard-bar-fill"
                          style={{
                            height: `${getBarHeight(
                              month.documentCount,
                              maxDocumentCount
                            )}%`,
                          }}
                        />
                      </span>
                      <span className="paycheck-dashboard-bar-label">
                        {formatMonth(month.month, true)}
                      </span>
                      <span
                        className={`paycheck-dashboard-bar-pending ${
                          hasMonthMissing ? "" : "paycheck-dashboard-bar-pending-empty"
                        }`}
                        aria-hidden="true"
                      >
                        {hasMonthMissing
                          ? `${formatNumber(month.missingFromPreviousCount)} falt.`
                          : hasMonthBase
                          ? "em dia"
                          : "sem base"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            className="paycheck-dashboard-panel paycheck-dashboard-comparison-panel"
            aria-labelledby={`${componentId}-comparison-title`}
          >
            <div className="paycheck-dashboard-panel-header">
              <div>
                <h5 id={`${componentId}-comparison-title`}>Comparação de colaboradores</h5>
                <p>
                  {previousMonthLabel} <span aria-hidden="true">→</span>
                  <span className="paycheck-dashboard-sr-only"> para </span>{" "}
                  {selectedMonthLabel}
                </p>
              </div>
              <span>{formatPercent(coverage)} de cobertura</span>
            </div>

            <div className="paycheck-dashboard-comparison-cards">
              <article className="paycheck-dashboard-comparison-card maintained">
                <span>Mantidos</span>
                <strong>{formatNumber(analytics.comparison.maintainedCount)}</strong>
                <small>presentes nos dois meses</small>
              </article>

              <article className="paycheck-dashboard-comparison-card new">
                <span>Novos</span>
                <strong>{formatNumber(analytics.comparison.newCount)}</strong>
                <small>somente no mês selecionado</small>
              </article>

              <article className="paycheck-dashboard-comparison-card missing">
                <span>Faltando</span>
                <strong>{formatNumber(analytics.comparison.missingCount)}</strong>
                <small>estavam no mês anterior</small>
              </article>
            </div>

            {hasComparisonBase ? (
              <div className="paycheck-dashboard-coverage">
                <div className="paycheck-dashboard-coverage-labels">
                  <span>Cobertura da base de {previousMonthLabel}</span>
                  <strong>{formatPercent(coverage)}</strong>
                </div>
                <div
                  className="paycheck-dashboard-coverage-track"
                  role="progressbar"
                  aria-label={`Cobertura da base de ${previousMonthLabel}`}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={Math.round(coverage || 0)}
                >
                  <span style={{ width: `${coverage || 0}%` }} />
                </div>
              </div>
            ) : (
              <p className="paycheck-dashboard-state paycheck-dashboard-state-neutral">
                Não há contracheques em {previousMonthLabel} para formar uma base de
                comparação.
              </p>
            )}

            {hasComparisonBase && !hasMissingUsers && (
              <p className="paycheck-dashboard-state paycheck-dashboard-state-success">
                Nenhuma pendência: todos os colaboradores da base anterior possuem
                contracheque em {selectedMonthLabel}.
              </p>
            )}
          </section>

          <section
            className="paycheck-dashboard-panel paycheck-dashboard-missing-panel"
            aria-labelledby={`${componentId}-missing-title`}
          >
            <div className="paycheck-dashboard-panel-header">
              <div>
                <h5 id={`${componentId}-missing-title`}>
                  Faltantes em {selectedMonthLabel}
                </h5>
                <p>
                  Colaboradores encontrados em {previousMonthLabel} sem documento na
                  competência selecionada.
                </p>
              </div>
              <span>{formatNumber(analytics.comparison.missingCount)} colaboradores</span>
            </div>

            {hasMissingUsers ? (
              <>
                {accountStatusError && (
                  <p
                    className="paycheck-dashboard-state paycheck-dashboard-state-warning"
                    role="status"
                  >
                    Não foi possível atualizar o status das contas. Use o filtro
                    “Todos” para não ocultar colaboradores com status não informado.
                  </p>
                )}

                <div className="paycheck-dashboard-missing-controls">
                  <label>
                    <span>Buscar colaborador</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Nome, CPF, e-mail ou setor"
                    />
                  </label>

                  <label>
                    <span>Status da conta</span>
                    <select
                      value={accountFilter}
                      onChange={(event) => setAccountFilter(event.target.value)}
                    >
                      <option value="all">Todos</option>
                      <option value="active">Ativos</option>
                      <option value="inactive">Inativos</option>
                      <option value="unknown">Não informado</option>
                    </select>
                  </label>
                </div>

                <div className="paycheck-dashboard-results-summary" aria-live="polite">
                  {formatNumber(filteredMissingUsers.length)} de {formatNumber(
                    analytics.comparison.missingCount
                  )} encontrados
                </div>

                {filteredMissingUsers.length ? (
                  <ul
                    className="paycheck-dashboard-missing-list"
                    aria-label={`Colaboradores sem contracheque em ${selectedMonthLabel}`}
                  >
                    {filteredMissingUsers.map((missingUser) => (
                      <li key={`${analytics.selectedMonth}-${missingUser.userId}`}>
                        <div className="paycheck-dashboard-missing-content">
                          <div className="paycheck-dashboard-missing-main">
                            <strong>{missingUser.nome}</strong>
                            <span>{missingUser.email || "E-mail não informado"}</span>
                          </div>

                          <div className="paycheck-dashboard-missing-details">
                            <span>
                              <b>CPF</b> {formatCpf(missingUser.cpf)}
                            </span>
                            <span>{missingUser.sectorName || "Sem setor"}</span>
                            <span
                              className={`paycheck-dashboard-account-status ${missingUser.accountStatus}`}
                            >
                              {getAccountStatusLabel(missingUser.accountStatus)}
                            </span>
                          </div>
                        </div>

                        {canUploadMissingPaycheck && (
                          <label className="paycheck-dashboard-upload-button">
                            <input
                              type="file"
                              accept="application/pdf"
                              disabled={uploadingMissingUserIds.includes(
                                missingUser.userId
                              )}
                              onChange={(event) =>
                                handleMissingPaycheckFileChange(event, missingUser)
                              }
                            />
                            <span>
                              {uploadingMissingUserIds.includes(missingUser.userId)
                                ? "Enviando..."
                                : "Adicionar contracheque"}
                            </span>
                          </label>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="paycheck-dashboard-state paycheck-dashboard-state-neutral">
                    Nenhum colaborador corresponde à busca e ao filtro selecionados.
                  </p>
                )}
              </>
            ) : (
              <p
                className={`paycheck-dashboard-state ${
                  hasComparisonBase
                    ? "paycheck-dashboard-state-success"
                    : "paycheck-dashboard-state-neutral"
                }`}
              >
                {hasComparisonBase
                  ? `Não há colaboradores faltando em ${selectedMonthLabel}.`
                  : `A lista ficará disponível quando houver uma base em ${previousMonthLabel}.`}
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
