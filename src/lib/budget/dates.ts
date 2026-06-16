export const MON_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function mondaysInRange(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start);
  const dow = d.getDay();
  if (dow !== 1) d.setDate(d.getDate() + ((8 - dow) % 7));
  while (d <= end) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export function periodFor(year: number, month: number) {
  const start = new Date(year, month, 14);
  const em = month === 11 ? 0 : month + 1;
  const ey = month === 11 ? year + 1 : year;
  return { start, end: new Date(ey, em, 13) };
}

export function currentPeriodStart(from: Date = new Date()): Date {
  if (from.getDate() >= 14) return new Date(from.getFullYear(), from.getMonth(), 14);
  const pm = from.getMonth() === 0 ? 11 : from.getMonth() - 1;
  const py = from.getMonth() === 0 ? from.getFullYear() - 1 : from.getFullYear();
  return new Date(py, pm, 14);
}

export function currentPeriodEnd(pStart: Date): Date {
  const em = pStart.getMonth() === 11 ? 0 : pStart.getMonth() + 1;
  const ey = pStart.getMonth() === 11 ? pStart.getFullYear() + 1 : pStart.getFullYear();
  return new Date(ey, em, 13);
}

/** Actual pay date for a given month (14th, or prior Friday if weekend). */
export function paydayFor(year: number, month: number): Date {
  const d = new Date(year, month, 14);
  const dow = d.getDay();
  if (dow === 6) d.setDate(13);
  else if (dow === 0) d.setDate(12);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Next payday on or after today (date-only comparison). */
export function nextPaydayFrom(today: Date): Date {
  const thisMonth = paydayFor(today.getFullYear(), today.getMonth());
  if (today.getTime() <= thisMonth.getTime()) return thisMonth;
  let m = today.getMonth() + 1;
  let y = today.getFullYear();
  if (m > 11) {
    m = 0;
    y++;
  }
  return paydayFor(y, m);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function currentPeriodLabel(from: Date = new Date()): string {
  const start = currentPeriodStart(from);
  return `${MON_NAMES[start.getMonth()]} ${start.getFullYear()}`;
}
