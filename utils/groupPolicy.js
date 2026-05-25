const SUPPORTED_GROUP_CURRENCIES = ["NGN", "USD", "GBP", "EUR"];
const SUPPORTED_GROUP_FREQUENCIES = ["weekly", "biweekly", "monthly"];

const REMINDER_DAYS_BY_FREQUENCY = {
  weekly: 2,
  biweekly: 2,
  monthly: 5,
};

export const GROUP_MEMBER_LIMITS = {
  min: 3,
  max: 36,
};

export const GROUP_LATE_FEE_PERCENT = 7.5;
export const GROUP_GRACE_PERIOD_HOURS = 24;
export const DEFAULT_ADMIN_PAYOUT_PERCENT = 1;
export const NIGERIA_ADMIN_PAYOUT_PERCENT = 0.25;

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const toPeriodBoundary = (date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );

export const normalizeGroupFrequency = (value = "") => {
  const raw = value.toString().trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (raw === "weekly") return "weekly";
  if (raw === "biweekly") return "biweekly";
  if (raw === "monthly") return "monthly";
  return "";
};

export const isSupportedCurrency = (value = "") =>
  SUPPORTED_GROUP_CURRENCIES.includes(value.toString().trim().toUpperCase());

export const getReminderDaysForFrequency = (frequency) =>
  REMINDER_DAYS_BY_FREQUENCY[normalizeGroupFrequency(frequency)] ?? 2;

export const getGroupCycleDurationLabel = (frequency, maxMembers) => {
  const normalized = normalizeGroupFrequency(frequency);
  const members = Number(maxMembers) || 0;
  if (members <= 0) return "";

  if (normalized === "weekly") {
    return `${members} weeks`;
  }
  if (normalized === "biweekly") {
    return `${members * 2} weeks`;
  }
  return `${members} months`;
};

export const getContributionPeriod = (group, now = new Date()) => {
  const anchor = new Date(group.startDate || group.createdAt || now);
  const normalized = normalizeGroupFrequency(group.contributionFrequency);
  const safeNow = new Date(now);

  let periodStart = toPeriodBoundary(anchor);
  let periodEnd = new Date(periodStart);

  while (periodStart <= safeNow) {
    const nextEnd =
      normalized === "weekly"
        ? addDays(periodStart, 7)
        : normalized === "biweekly"
          ? addDays(periodStart, 14)
          : addMonths(periodStart, 1);
    if (safeNow < nextEnd) {
      periodEnd = nextEnd;
      break;
    }
    periodStart = nextEnd;
  }

  const dueDate = new Date(periodEnd.getTime() - 1);
  const reminderDate = addDays(
    dueDate,
    -getReminderDaysForFrequency(group.contributionFrequency)
  );
  const graceDeadline = new Date(
    dueDate.getTime() + GROUP_GRACE_PERIOD_HOURS * 60 * 60 * 1000
  );

  return {
    periodStart,
    periodEnd: new Date(periodEnd.getTime() - 1),
    dueDate,
    reminderDate,
    graceDeadline,
  };
};

export const calculateLateFee = (amount) => {
  const value = Number(amount) || 0;
  return Number(((value * GROUP_LATE_FEE_PERCENT) / 100).toFixed(2));
};

export const getAdminPayoutPercent = ({ currencyCode, ownerCountry, ownerLocation } = {}) => {
  const country =
    ownerCountry?.toString().trim().toLowerCase() ||
    ownerLocation?.toString().trim().toLowerCase() ||
    "";
  if (
    currencyCode?.toString().trim().toUpperCase() === "NGN" ||
    country.includes("nigeria")
  ) {
    return NIGERIA_ADMIN_PAYOUT_PERCENT;
  }
  return DEFAULT_ADMIN_PAYOUT_PERCENT;
};

export const roundMoney = (value) => Number((Number(value) || 0).toFixed(2));

export {
  SUPPORTED_GROUP_CURRENCIES,
  SUPPORTED_GROUP_FREQUENCIES,
};
