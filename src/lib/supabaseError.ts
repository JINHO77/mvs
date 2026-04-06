type ErrorLike = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

export function toPrettyErrorString(error: unknown): string {
  if (error instanceof Error) {
    return error.message || "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const payload = error as ErrorLike;
    const parts = [
      typeof payload.message === "string" ? `message=${payload.message}` : "",
      typeof payload.details === "string" ? `details=${payload.details}` : "",
      typeof payload.hint === "string" ? `hint=${payload.hint}` : "",
      typeof payload.code === "string" ? `code=${payload.code}` : "",
    ].filter((part) => part.length > 0);

    let raw = "";
    try {
      raw = `raw=${JSON.stringify(error)}`;
    } catch {
      raw = "raw=[unserializable]";
    }

    return parts.length > 0 ? `${parts.join(" | ")} | ${raw}` : raw;
  }

  return String(error);
}
