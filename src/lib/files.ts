export function safeFileName(originalName: string, fallback = "file"): string {
  const trimmed = (originalName || fallback).trim();
  const parts = trimmed.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".") || fallback;

  const slug = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  const safeBase = slug.length > 0 ? slug : fallback;
  const safeExt = ext ? ext.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 10) : "";
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}
