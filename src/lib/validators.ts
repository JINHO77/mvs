export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function normalizeMonthKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;

  const monthMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const mm = Number(monthMatch[2]);
    return mm >= 1 && mm <= 12 ? `${monthMatch[1]}-${monthMatch[2]}` : null;
  }

  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const mm = Number(dateMatch[2]);
    return mm >= 1 && mm <= 12 ? `${dateMatch[1]}-${dateMatch[2]}` : null;
  }

  return null;
}
