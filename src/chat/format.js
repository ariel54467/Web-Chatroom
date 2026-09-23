export function clockTime(date) {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export function dayLabel(date) {
  const parsed = new Date(date);
  return parsed.toDateString() === new Date().toDateString() ? "Today"
    : new Intl.DateTimeFormat([], { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}
