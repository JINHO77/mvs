import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 미들웨어를 통과시키는 공개 경로(인증 불필요).
// /blocked는 비활성 사용자가 머물 곳이라 공개 처리하되, active 사용자가 들어오면 홈으로 돌려보낸다.
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password", // 이메일로 재설정 링크 보내기
  "/reset-password", // 새 비밀번호 설정 (이메일 링크 도착지)
  "/dev-login",
  "/blocked",
  "/auth", // /auth/callback 등 Supabase 인증 콜백
  "/api/auth", // /api/auth/signout, /api/auth/cleanup
  "/api/cron", // 크론 작업 endpoint
  "/_next",
  "/favicon",
  "/manifest",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;
  const publicPath = isPublicPath(path);

  // 1) 미인증 + 보호 경로 → 로그인으로
  if (!user && !publicPath) {
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 2) 인증된 사용자의 status 체크
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status, role")
      .eq("id", user.id)
      .maybeSingle<{ account_status: string | null; role: string | null }>();

    const status = profile?.account_status ?? null;
    const role = profile?.role ?? null;
    // owner/teacher는 status 무관하게 통과(관리자 권한). 학생/학부모만 active 필수.
    const isStaff = role === "owner" || role === "teacher";

    // active 사용자가 /blocked에 들어오면 홈으로 되돌린다.
    if (path === "/blocked" && status === "active") {
      url.pathname = role === "owner" || role === "teacher" ? "/owner" : "/";
      url.search = "";
      return NextResponse.redirect(url);
    }

    // 비활성 사용자(staff 제외)는 /blocked로. 이미 거기 있거나 공개 경로면 통과.
    if (!isStaff && status !== "active" && !publicPath) {
      url.pathname = "/blocked";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 자산과 명백한 파일 확장자는 미들웨어 건너뜀
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
