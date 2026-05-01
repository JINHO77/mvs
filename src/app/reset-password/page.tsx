"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PublicHeader from "@/components/common/PublicHeader";
import { supabase } from "@/lib/supabaseClient";

type Stage = "checking" | "expired" | "form" | "success";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [statusMessage, setStatusMessage] = useState<string | null>("재설정 링크를 확인하고 있어요...");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn("[reset-password] exchangeCodeForSession failed", exchangeError);
            setStage("expired");
            setStatusMessage(null);
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setStage("expired");
          setStatusMessage(null);
          return;
        }

        setStage("form");
        setStatusMessage(null);
      } catch (e: unknown) {
        console.error("[reset-password] session bootstrap failed", e);
        setStage("expired");
        setStatusMessage(null);
      }
    })();
  }, []);

  const updatePassword = async () => {
    setSubmitError(null);

    if (password.length < 8) {
      setPasswordError("비밀번호는 8자 이상이어야 해요");
      return;
    }
    if (password !== passwordConfirm) {
      setPasswordError("비밀번호가 일치하지 않아요");
      return;
    }
    setPasswordError(null);

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStage("success");
      setTimeout(() => router.replace("/login"), 3000);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "비밀번호 변경에 실패했어요.";
      setSubmitError(`${message} 링크가 만료되었을 수 있어요.`);
    } finally {
      setSaving(false);
    }
  };

  const submitDisabled =
    saving ||
    !password ||
    !passwordConfirm ||
    password !== passwordConfirm ||
    password.length < 8 ||
    !!passwordError;

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
          {stage === "checking" && (
            <div className="py-6 text-center text-sm text-[var(--text-muted)]">
              {statusMessage ?? "확인 중..."}
            </div>
          )}

          {stage === "expired" && (
            <div className="text-center">
              <div className="text-5xl">⚠️</div>
              <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">링크가 만료되었어요</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                비밀번호 재설정 링크는 1시간 동안만 유효해요.<br />
                다시 신청해 주세요.
              </p>
              <Link
                href="/forgot-password"
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)]"
              >
                새 링크 받기
              </Link>
              <Link
                href="/login"
                className="mt-3 block text-center text-sm text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)]"
              >
                ← 로그인 페이지로 돌아가기
              </Link>
            </div>
          )}

          {stage === "form" && (
            <>
              <h1 className="text-2xl font-semibold text-[var(--text)]">새 비밀번호 설정</h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                새로 사용할 비밀번호를 입력해 주세요.
              </p>

              <label className="mb-2 mt-6 block text-sm text-[var(--text)]">새 비밀번호 (8자 이상)</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)]"
                value={password}
                onChange={(e) => {
                  const next = e.target.value;
                  setPassword(next);
                  if (passwordConfirm && next !== passwordConfirm) {
                    setPasswordError("비밀번호가 일치하지 않아요");
                  } else {
                    setPasswordError(null);
                  }
                }}
              />

              <label className="mb-2 mt-4 block text-sm text-[var(--text)]">비밀번호 확인</label>
              <input
                type="password"
                autoComplete="new-password"
                className={`w-full rounded-xl border bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)] ${
                  passwordError ? "border-[var(--danger-text)]" : "border-[var(--border)]"
                }`}
                value={passwordConfirm}
                onChange={(e) => {
                  const next = e.target.value;
                  setPasswordConfirm(next);
                  if (password && next && password !== next) {
                    setPasswordError("비밀번호가 일치하지 않아요");
                  } else {
                    setPasswordError(null);
                  }
                }}
                onBlur={() => {
                  if (password && passwordConfirm && password !== passwordConfirm) {
                    setPasswordError("비밀번호가 일치하지 않아요");
                  }
                }}
              />
              {passwordError && (
                <p className="mt-1 text-[13px] text-[var(--danger-text)]">⚠️ {passwordError}</p>
              )}
              {!passwordError && password && passwordConfirm && password === passwordConfirm && (
                <p className="mt-1 text-[13px] text-[var(--success-text)]">✅ 비밀번호가 일치해요</p>
              )}

              <button
                type="button"
                className="mt-5 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)] disabled:opacity-60"
                onClick={() => void updatePassword()}
                disabled={submitDisabled}
              >
                {saving ? "변경 중..." : "비밀번호 변경"}
              </button>

              {submitError && (
                <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
                  {submitError}
                </div>
              )}

              <Link
                href="/login"
                className="mt-3 block text-center text-sm text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)]"
              >
                ← 로그인 페이지로 돌아가기
              </Link>
            </>
          )}

          {stage === "success" && (
            <div className="text-center">
              <div className="text-5xl">✅</div>
              <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">비밀번호 변경 완료!</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                새 비밀번호로 로그인해 주세요.<br />
                잠시 후 로그인 페이지로 이동해요...
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
