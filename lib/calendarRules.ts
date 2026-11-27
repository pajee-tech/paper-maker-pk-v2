/** ISO calendar dates are deliberately stored without time zones. */
export function validDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export type DateRange = { startDate: string; endDate: string; tentative?: boolean };
export function teachingDates(start: string, end: string, holidays: DateRange[], workingDays = [1, 2, 3, 4, 5, 6]): string[] {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error("Invalid date range");
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if ((last.getTime() - cursor.getTime()) / 86400000 > 366) throw new Error("Select at most 367 calendar days");
  for (; cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    if (workingDays.includes(cursor.getUTCDay()) && !holidays.some(h => !h.tentative && key >= h.startDate && key <= h.endDate)) out.push(key);
  }
  return out;
}
