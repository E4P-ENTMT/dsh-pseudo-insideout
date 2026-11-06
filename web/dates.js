// The console displays calendar dates in Shanghai, independent of browser TZ.
const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });

export function dateInput(value) {
  if (!value) return '';
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return '';
  const parts = Object.fromEntries(calendar.formatToParts(instant).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function deadlineFromInput(value, original = null) {
  // A date-only control must not discard an existing clock time or precision
  // when the user edits another field or saves an unchanged calendar date.
  if (value === dateInput(original)) return original || null;
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('日期无效');
  const instant = new Date(`${value}T23:59:59+08:00`);
  if (!Number.isFinite(instant.getTime()) || dateInput(instant) !== value) throw new RangeError('日期无效');
  return instant.toISOString();
}
