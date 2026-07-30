// All dates are handled as local-time "YYYY-MM-DD" strings.

export function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

// The 30-day window ending on `endKey` (inclusive).
export function windowDays(endKey, length = 30) {
  const days = [];
  for (let i = length - 1; i >= 0; i--) {
    const key = addDays(endKey, -i);
    const date = fromKey(key);
    days.push({
      key,
      date,
      dayOfMonth: date.getDate(),
      weekday: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: key === todayKey(),
      isFuture: key > todayKey(),
    });
  }
  return days;
}

export function monthLabel(days) {
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const fmt = (d, withYear) =>
    d.toLocaleDateString(undefined, { month: "long", ...(withYear ? { year: "numeric" } : {}) });

  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear())
    return fmt(last, true);
  return `${fmt(first, first.getFullYear() !== last.getFullYear())} – ${fmt(last, true)}`;
}
