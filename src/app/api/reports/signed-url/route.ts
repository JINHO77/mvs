import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reportId, expiresIn } = (await request.json()) as { reportId?: string; expiresIn?: number };
    if (!reportId || typeof reportId !== "string") {
      return NextResponse.json({ error: "reportId is required" }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const { data: requester, error: requesterError } = await supabaseAdmin
      .from("profiles")
      .select("id,role,account_status,academy_id")
      .eq("id", userId)
      .maybeSingle<{ id: string; role: string | null; account_status: string | null; academy_id: string | null }>();

    // Authorization failures collapse to 404 ("Not found") rather than 403 to
    // avoid leaking which reportIds exist. Authentication failure (401) above
    // is unaffected — that's a missing token, not an existence oracle.
    if (requesterError || !requester) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if ((requester.account_status ?? "active") !== "active") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: report, error: reportError } = await supabaseAdmin
      .from("reports")
      .select("id,academy_id,student_id,math_pdf_path,math_pdf_name")
      .eq("id", reportId)
      .eq("is_deleted", false)
      .maybeSingle<{
        id: string;
        academy_id: string;
        student_id: string;
        math_pdf_path: string | null;
        math_pdf_name: string | null;
      }>();

    if (reportError || !report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!report.math_pdf_path) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let allowed = false;
    if (requester.role === "owner") {
      allowed = requester.academy_id === report.academy_id;
    } else if (requester.role === "student") {
      allowed = requester.id === report.student_id;
    } else if (requester.role === "parent") {
      const { data: linkRow, error: linkError } = await supabaseAdmin
        .from("student_guardians")
        .select("student_id")
        .eq("guardian_id", requester.id)
        .eq("student_id", report.student_id)
        .maybeSingle<{ student_id: string }>();
      allowed = !linkError && !!linkRow;
    }

    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ttl = typeof expiresIn === "number" ? Math.max(30, Math.min(3600, Math.floor(expiresIn))) : 120;
    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from("report_attachments")
      .createSignedUrl(report.math_pdf_path, ttl);

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: signedError?.message ?? "Failed to create signed URL" }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: signed.signedUrl, fileName: report.math_pdf_name ?? undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
