const DEFAULT_WINDOW_SIZE = 12;

function normalizeMonthPart(value) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function normalizeUserId(value) {
  if (value === null || value === undefined) return "";

  const normalized = String(value).trim();
  if (!normalized) return "";

  if (/^\d+$/.test(normalized)) {
    return normalized.replace(/^0+(?=\d)/, "");
  }

  return normalized;
}

function normalizeAccountStatus(value) {
  if (Number(value) === 1) return "active";
  if (Number(value) === 0 && value !== "" && value !== null) return "inactive";
  return "unknown";
}

function firstPresent(...values) {
  return values.find(
    (value) => value !== null && value !== undefined && String(value).trim() !== ""
  );
}

function buildUserSnapshot(paycheck, userId) {
  return {
    userId,
    nome: firstPresent(paycheck.user_nome, paycheck.nome, "Usuário"),
    email: firstPresent(paycheck.email, paycheck.user_email) ?? "",
    cpf: firstPresent(paycheck.cpf, paycheck.user_cpf) ?? "",
    sectorName: firstPresent(
      paycheck.sector_name,
      paycheck.user_sector_name,
      paycheck.setor,
      "Sem setor"
    ),
    accountStatus: normalizeAccountStatus(paycheck.user_is_active),
  };
}

function mergeUserSnapshots(current, next) {
  if (!current) return next;

  return {
    userId: current.userId,
    nome: current.nome === "Usuário" ? next.nome : current.nome,
    email: current.email || next.email,
    cpf: current.cpf || next.cpf,
    sectorName:
      current.sectorName === "Sem setor" ? next.sectorName : current.sectorName,
    accountStatus:
      current.accountStatus === "unknown"
        ? next.accountStatus
        : current.accountStatus,
  };
}

export function createMonthKey(yearValue, monthValue) {
  const year = normalizeMonthPart(yearValue);
  const month = normalizeMonthPart(monthValue);

  if (!year || year < 1 || year > 9999 || !month || month < 1 || month > 12) {
    return "";
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(monthKey) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(monthKey || ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1) return null;

  return { year, month };
}

export function shiftMonthKey(monthKey, offset) {
  const parsed = parseMonthKey(monthKey);
  const normalizedOffset = Number(offset);

  if (!parsed || !Number.isInteger(normalizedOffset)) return "";

  const absoluteMonth = parsed.year * 12 + (parsed.month - 1) + normalizedOffset;
  const year = Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12 + 1;

  return createMonthKey(year, month);
}

export function getCurrentMonthKey(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return createMonthKey(date.getFullYear(), date.getMonth() + 1);
}

export function createContinuousMonthRange(
  endMonthKey,
  size = DEFAULT_WINDOW_SIZE
) {
  const normalizedSize = Number(size);

  if (!parseMonthKey(endMonthKey) || !Number.isInteger(normalizedSize) || normalizedSize < 1) {
    return [];
  }

  return Array.from({ length: normalizedSize }, (_, index) =>
    shiftMonthKey(endMonthKey, index - normalizedSize + 1)
  );
}

function compareUserNames(first, second) {
  return String(first.nome || "").localeCompare(String(second.nome || ""), "pt-BR", {
    sensitivity: "base",
  });
}

function getMonthComparison(monthKey, usersByMonth) {
  const previousMonth = shiftMonthKey(monthKey, -1);
  const currentUsers = usersByMonth.get(monthKey) || new Map();
  const previousUsers = usersByMonth.get(previousMonth) || new Map();

  const maintainedUsers = [];
  const newUsers = [];
  const missingUsers = [];

  currentUsers.forEach((user, userId) => {
    if (previousUsers.has(userId)) maintainedUsers.push(user);
    else newUsers.push(user);
  });

  previousUsers.forEach((user, userId) => {
    if (!currentUsers.has(userId)) missingUsers.push(user);
  });

  maintainedUsers.sort(compareUserNames);
  newUsers.sort(compareUserNames);
  missingUsers.sort(compareUserNames);

  const previousUserCount = previousUsers.size;
  const maintainedCount = maintainedUsers.length;

  return {
    month: monthKey,
    previousMonth,
    currentUserCount: currentUsers.size,
    previousUserCount,
    maintainedCount,
    newCount: newUsers.length,
    missingCount: missingUsers.length,
    coverage:
      previousUserCount > 0 ? (maintainedCount / previousUserCount) * 100 : null,
    maintainedUsers,
    newUsers,
    missingUsers,
  };
}

/**
 * Builds the read-only paycheck dashboard model.
 *
 * `is_active` is the paycheck/document status. All valid rows contribute to
 * the stored total, while only documents whose numeric value is 1 participate
 * in monthly availability and comparisons. `user_is_active` is account
 * metadata, so an inactive account can still be identified in the missing list.
 */
export function buildPaycheckAnalytics(
  paychecks,
  {
    selectedMonth,
    referenceMonth = getCurrentMonthKey(),
    windowSize = DEFAULT_WINDOW_SIZE,
  } = {}
) {
  const normalizedReferenceMonth = parseMonthKey(referenceMonth)
    ? referenceMonth
    : getCurrentMonthKey();
  const normalizedSelectedMonth = parseMonthKey(selectedMonth)
    ? selectedMonth
    : normalizedReferenceMonth;
  const monthKeys = createContinuousMonthRange(
    normalizedReferenceMonth,
    windowSize
  );
  const documentCountByMonth = new Map();
  const usersByMonth = new Map();
  const storedDocuments = [];
  const validDocuments = [];

  if (Array.isArray(paychecks)) {
    paychecks.forEach((paycheck) => {
      if (!paycheck) return;

      const monthKey = createMonthKey(paycheck.ano, paycheck.mes);
      const userId = normalizeUserId(paycheck.user_id);
      if (!monthKey || !userId) return;

      storedDocuments.push(paycheck);
      if (Number(paycheck.is_active) !== 1) return;

      validDocuments.push(paycheck);
      documentCountByMonth.set(
        monthKey,
        (documentCountByMonth.get(monthKey) || 0) + 1
      );

      if (!usersByMonth.has(monthKey)) usersByMonth.set(monthKey, new Map());

      const monthUsers = usersByMonth.get(monthKey);
      const userSnapshot = buildUserSnapshot(paycheck, userId);
      monthUsers.set(
        userId,
        mergeUserSnapshots(monthUsers.get(userId), userSnapshot)
      );
    });
  }

  const series = monthKeys.map((month) => {
    const comparison = getMonthComparison(month, usersByMonth);

    return {
      month,
      documentCount: documentCountByMonth.get(month) || 0,
      uniqueUserCount: usersByMonth.get(month)?.size || 0,
      missingFromPreviousCount: comparison.missingCount,
      coverage: comparison.coverage,
    };
  });

  const comparison = getMonthComparison(normalizedSelectedMonth, usersByMonth);

  return {
    storedDocuments: storedDocuments.length,
    totalDocuments: validDocuments.length,
    inactiveDocuments: storedDocuments.length - validDocuments.length,
    selectedMonth: normalizedSelectedMonth,
    selectedDocumentCount:
      documentCountByMonth.get(normalizedSelectedMonth) || 0,
    previousDocumentCount:
      documentCountByMonth.get(comparison.previousMonth) || 0,
    series,
    comparison,
  };
}

export default buildPaycheckAnalytics;
