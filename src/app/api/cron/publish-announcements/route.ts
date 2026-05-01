import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// Called by Vercel Cron every 15 minutes.
// Publishes scheduled announcements whose scheduled_at has passed.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const expected = cronSecret ? `Bearer ${cronSecret}` : null;

  if (!expected || !authHeader || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("announcements")
      .update({ published_at: now })
      .lte("scheduled_at", now)
      .is("published_at", null)
      .eq("is_deleted", false)
      .select("id");

    if (error) {
      console.error("[cron/publish-announcements] DB error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const count = data?.length ?? 0;
    console.log(`[cron/publish-announcements] published ${count} announcement(s)`);
    return NextResponse.json({ published: count, at: now });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[cron/publish-announcements] unexpected error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
