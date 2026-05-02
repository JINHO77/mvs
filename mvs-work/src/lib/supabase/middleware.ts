import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      [
        "mvs-work Supabase 환경변수가 없습니다.",
        "c:\\dev\\mvs\\mvs-work\\.env.local 파일을 만들고 아래 두 값을 넣어주세요.",
        "NEXT_PUBLIC_SUPABASE_URL=https://새프로젝트ref.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=새 Supabase anon public key",
        "파일명이 .env.local.txt가 아닌지 확인하고, dev server를 재시작해주세요.",
      ].join("\n"),
    );
  }

  if (url.includes("/rest/v1")) {
    throw new Error(
      [
        "NEXT_PUBLIC_SUPABASE_URL에는 REST API 주소가 아니라 프로젝트 URL을 넣어야 합니다.",
        "잘못된 예: https://새프로젝트ref.supabase.co/rest/v1/",
        "올바른 예: https://새프로젝트ref.supabase.co",
      ].join("\n"),
    );
  }

  if (anonKey.startsWith("eyJ") && anonKey.split(".").length !== 3) {
    throw new Error(
      [
        "NEXT_PUBLIC_SUPABASE_ANON_KEY 값이 올바른 JWT 형식이 아닙니다.",
        "Supabase Dashboard > Project Settings > API에서 anon public key를 다시 복사해주세요.",
        "JWT 형식의 anon key는 보통 점(.)으로 나뉜 3개 조각입니다.",
        "복사 중 줄바꿈, 공백, 다른 키가 섞이지 않았는지 확인한 뒤 dev server를 재시작해주세요.",
      ].join("\n"),
    );
  }

  return { anonKey, url };
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { anonKey, url } = getSupabaseEnv();

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: Parameters<typeof response.cookies.set>[2];
          }>,
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response = NextResponse.next({ request });
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}
