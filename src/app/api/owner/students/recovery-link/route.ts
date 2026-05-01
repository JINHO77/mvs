import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  studentId?: string;
  email?: string;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const studentId = body.studentId?.trim();
  const explicitEmail = body.email?.trim();
  if (!studentId && !explicitEmail) {
    return NextResponse.json({ error: "studentId 또는 email이 필요합니다." }, { status: 400 });
  }

  // 1) 호출자가 owner/teacher인지 확인 (세션 기반)
  const userClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: me, error: meError } = await userClient
    .from("profiles")
    .select("role, account_status")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null; account_status: string | null }>();
  if (meError) {
    return NextResponse.json({ error: meError.message }, { status: 500 });
  }
  if (me?.role !== "owner" && me?.role !== "teacher") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if ((me?.account_status ?? "active") !== "active") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 2) 대상 이메일 결정 (studentId가 우선)
  const admin = getSupabaseAdmin();
  let targetEmail = explicitEmail ?? null;
  let targetName: string | null = null;
  if (studentId) {
    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("email, name, role")
      .eq("id", studentId)
      .maybeSingle<{ email: string | null; name: string | null; role: string | null }>();
    if (targetError) {
      return NextResponse.json({ error: targetError.message }, { status: 500 });
    }
    if (!target) {
      return NextResponse.json({ error: "대상 사용자를 찾을 수 없습니다." }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json({ error: "원장 계정은 처리할 수 없습니다." }, { status: 400 });
    }
    if (!target.email) {
      return NextResponse.json({ error: "대상 사용자의 이메일이 등록되어 있지 않습니다." }, { status: 400 });
    }
    targetEmail = target.email;
    targetName = target.name;
  }

  if (!targetEmail) {
    return NextResponse.json({ error: "대상 이메일이 없습니다." }, { status: 400 });
  }

  // 3) 복구 링크 생성
  const origin = request.nextUrl.origin;
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: targetEmail,
    options: {
      redirectTo: `${origin}/reset-password`,
    },
  });
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const actionLink = linkData?.properties?.action_link ?? null;
  if (!actionLink) {
    return NextResponse.json({ error: "복구 링크를 생성하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    email: targetEmail,
    name: targetName,
    actionLink,
  });
}
