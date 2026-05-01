"use client";

import Link from "next/link";
import { useState } from "react";
import PublicHeader from "@/components/common/PublicHeader";
import { supabase } from "@/lib/supabaseClient";

type Stage = "form" | "sent";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("이메일을 입력해 주세요.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      // 이메일 enumeration 방지: 결과와 무관하게 동일한 성공 화면을 보여준다.
      const { error: rpcError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (rpcError) {
        console.warn("[forgot-password] resetPasswordForEmail returned error", rpcError);
      }
      setStage("sent");
    } catch (e: unknown) {
      console.error("[forgot-password] unexpected failure", e);
      setError("일시적 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
          <h1 className="text-2xl font-semibold text-[var(--text)]">비밀번호 찾기</h1>

          {stage === "form" && (
            <>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                가입하신 이메일을 입력하시면 비밀번호 재설정 링크를 보내드려요.
              </p>

              <label className="mt-6 mb-2 block text-sm text-[var(--text)]">이메일</label>
              <input
                type="email"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@school.com"
                autoComplete="email"
                disabled={loading}
              />

              <button
                type="button"
                className="mt-4 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)] disabled:opacity-60"
                onClick={() => void sendEmail()}
                disabled={loading || email.trim().length === 0}
              >
                {loading ? "보내는 중..." : "복구 링크 보내기"}
              </button>

              {error && (
                <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
                  ⚠️ {error}
                </div>
              )}
            </>
          )}

          {stage === "sent" && (
            <>
              <div className="mt-4 text-5xl">📧</div>
              <p className="mt-4 text-base font-semibold text-[var(--text)]">이메일을 확인하세요</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                입력하신 이메일로 비밀번호 재설정 링크를 보냈어요.<br />
                메일이 안 보이면 스팸함도 확인해 주세요.
              </p>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                재설정 링크는 1시간 동안만 유효해요.
              </p>
              <button
                type="button"
                className="mt-5 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] hover:border-[var(--accent)]"
                onClick={() => {
                  setStage("form");
                  setError(null);
                }}
              >
                다른 이메일로 다시 보내기
              </button>
            </>
          )}

          <Link
            href="/login"
            className="mt-3 block text-center text-sm text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)]"
          >
            ← 로그인 페이지로 돌아가기
          </Link>
        </div>
      </main>
    </>
  );
}
