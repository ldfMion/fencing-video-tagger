const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/;

export function normalizeBoutDate(value?: string | null): string | undefined {
  const candidate = value?.trim();
  if (!candidate) {
    return undefined;
  }

  const isoMatch = ISO_DATE_PATTERN.exec(candidate);
  if (isoMatch) {
    return isCalendarDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    ) ? candidate : undefined;
  }

  const slashMatch = SLASH_DATE_PATTERN.exec(candidate);
  if (!slashMatch) {
    return undefined;
  }

  const day = Number(slashMatch[1]);
  const month = Number(slashMatch[2]);
  const rawYear = Number(slashMatch[3]);
  const year = slashMatch[3].length === 2 ? 2000 + rawYear : rawYear;
  if (!isCalendarDate(year, month, day)) {
    return undefined;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}
