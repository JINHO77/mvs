"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ParentOnboardingLinkRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const target = code ? `/link-student?code=${encodeURIComponent(code)}` : "/link-student";
    router.replace(target);
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
      이동 중...
    </main>
  );
}

export default function ParentOnboardingLinkRedirect() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
          이동 중...
        </main>
      }
    >
      <ParentOnboardingLinkRedirectInner />
    </Suspense>
  );
}
