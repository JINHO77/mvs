export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function textOrDash(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return "-";
  return value;
}
