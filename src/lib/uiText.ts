const DISPLAY_OBJECT_KEYS = [
  "title",
  "subtitle",
  "description",
  "name",
  "label",
  "text",
  "message",
  "body",
  "summary",
  "requirement_text",
  "requirementText",
  "condition_label",
  "conditionLabel",
] as const;

export function decodeUnicodeEscapes(value: string): string {
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\\r\\n/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePossibleJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const looksLikeJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'));

  if (!looksLikeJson) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function extractObjectDisplayText(value: Record<string, unknown>, seen: WeakSet<object>): string {
  for (const key of DISPLAY_OBJECT_KEYS) {
    if (key in value) {
      const normalized = normalizeDisplayTextInternal(value[key], "", seen);
      if (normalized) return normalized;
    }
  }

  for (const nestedValue of Object.values(value)) {
    const normalized = normalizeDisplayTextInternal(nestedValue, "", seen);
    if (normalized) return normalized;
  }

  return "";
}

function normalizeStringValue(value: string, seen: WeakSet<object>): string {
  const parsed = parsePossibleJson(value);
  if (parsed !== undefined) {
    const normalizedParsed = normalizeDisplayTextInternal(parsed, "", seen);
    if (normalizedParsed) return normalizedParsed;
  }

  const decoded = value.includes("\\u") ? decodeUnicodeEscapes(value) : value;
  return normalizeWhitespace(decoded);
}

function normalizeDisplayTextInternal(value: unknown, fallback: string, seen: WeakSet<object>): string {
  if (value == null) return fallback;

  if (typeof value === "string") {
    const normalized = normalizeStringValue(value, seen);
    return normalized || fallback;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeDisplayTextInternal(item, "", seen);
      if (normalized) return normalized;
    }
    return fallback;
  }

  if (typeof value === "object") {
    if (seen.has(value)) return fallback;
    seen.add(value);
    const normalized = extractObjectDisplayText(value as Record<string, unknown>, seen);
    return normalized || fallback;
  }

  return fallback;
}

export function normalizeDisplayText(value: unknown, fallback = ""): string {
  return normalizeDisplayTextInternal(value, fallback, new WeakSet<object>());
}

export const safeBadgeText = normalizeDisplayText;

export function normalizeUiText(value: unknown): string {
  return normalizeDisplayText(value, "");
}
