// All business dates are stored as 'YYYY-MM-DD' strings so a "day" never shifts with time zones.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Today's date in the server's local time zone
export function todayString() {
  return new Date().toLocaleDateString('en-CA');
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

// Payroll week containing dateStr. weekStartDay: 0 = Sunday ... 6 = Saturday
export function weekRange(dateStr, weekStartDay = 6) {
  const diff = (dayOfWeek(dateStr) - weekStartDay + 7) % 7;
  const start = addDays(dateStr, -diff);
  return { start, end: addDays(start, 6) };
}

export function daysBetween(start, end) {
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
