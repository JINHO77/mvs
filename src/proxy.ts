import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser()가 쿠키를 갱신함 — 반드시 호출
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith("/student") ||
    pathname.startsWith("/owner") ||
    pathname.startsWith("/parent") ||
    pathname.startsWith("/teacher");

  const isAuthPage = pathname === "/login" || pathname === "/signup";

  // 비로그인 + 보호 경로 → 로그인
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // 로그인된 상태에서 프로필 확인
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, account_status")
      .eq("id", user.id)
      .maybeSingle<{ role: string; account_status: string }>();

    // 차단 계정 → 로그아웃 후 로그인 페이지
    if (profile?.account_status === "blocked") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "blocked");
      url.searchParams.delete("redirectTo");
      const response = NextResponse.redirect(url);
      // 세션 쿠키 삭제
      request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith("sb-")) response.cookies.delete(name);
      });
      return response;
    }

    // 승인 대기 학생 + 보호 경로 → 승인 대기 페이지
    if (profile?.account_status === "pending" && isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending-approval";
      return NextResponse.redirect(url);
    }

    // 로그인된 상태로 로그인/가입 페이지 접근 → role별 대시보드로
    if (isAuthPage && profile?.account_status === "active") {
      const redirectTo = request.nextUrl.searchParams.get("redirectTo");

      let target = "/student";
      if (profile.role === "owner" || profile.role === "teacher") target = "/owner";
      else if (profile.role === "parent") target = "/parent";

      const url = request.nextUrl.clone();
      url.pathname = redirectTo ?? target;
      url.searchParams.delete("redirectTo");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
