// Format a Date as a datetime-local input value (YYYY-MM-DDTHH:mm) using LOCAL
// components, so it re-parses (via `new Date`) to the same instant the API stored
// — a UTC-formatted value would drift by the timezone offset on edit.
export function toDateTimeLocal(date: Date): string {
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
