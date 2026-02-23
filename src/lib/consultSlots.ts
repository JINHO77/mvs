import type { SupabaseClient } from "@supabase/supabase-js";

function parseDateParts(date: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function nextDate(date: string): string {
  const parts = parseDateParts(date);
  if (!parts) return date;
  const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 10; hour < 14; hour += 1) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
    slots.push(`${String(hour).padStart(2, "0")}:30`);
  }
  for (let hour = 22; hour < 24; hour += 1) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
    slots.push(`${String(hour).padStart(2, "0")}:30`);
  }
  return slots;
}

export function kstDateTimeToIso(date: string, hhmm: string): string | null {
  const parts = parseDateParts(date);
  if (!parts) return null;
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  const utcMs = Date.UTC(parts.y, parts.m - 1, parts.d, hh - 9, mm, 0, 0);
  return new Date(utcMs).toISOString();
}

export function isoToKstHm(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(d);
}

export async function loadConfirmedSlots(supabase: SupabaseClient, date: string): Promise<Set<string>> {
  if (!date) {
    return new Set();
  }

  const startIso = kstDateTimeToIso(date, "00:00");
  const endIso = kstDateTimeToIso(nextDate(date), "00:00");

  if (!startIso || !endIso) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("consultation_requests")
    .select("requested_start_at")
    .in("status", ["confirmed", "done"])
    .gte("requested_start_at", startIso)
    .lt("requested_start_at", endIso)
    .returns<Array<{ requested_start_at: string }>>();

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row) => isoToKstHm(row.requested_start_at)));
}

export async function loadOwnerBlockedSlots(supabase: SupabaseClient, date: string): Promise<Set<string>> {
  if (!date) {
    return new Set();
  }

  const startIso = kstDateTimeToIso(date, "00:00");
  const endIso = kstDateTimeToIso(nextDate(date), "00:00");

  if (!startIso || !endIso) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("consultation_blocked_slots")
    .select("start_at,end_at")
    .lt("start_at", endIso)
    .gt("end_at", startIso)
    .returns<Array<{ start_at: string; end_at: string }>>();

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row) => isoToKstHm(row.start_at)));
}
