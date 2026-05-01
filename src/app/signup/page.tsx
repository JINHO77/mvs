"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PublicHeader from "@/components/common/PublicHeader";
import { AUTH_TEXT } from "@/constants/auth.ko";
import { supabase } from "@/lib/supabaseClient";

type SchoolLevel = "elementary" | "middle" | "high";

function getSafeRedirect(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("redirectTo");
  if (!value || !value.startsWith("/")) return null;
  return value;
}

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"student" | "parent">("student");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel | "">("");
  const [grade, setGrade] = useState<number | "">("");
  const [classLabel, setClassLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get("role");
    setMode(role === "parent" ? "parent" : "student");
    setRedirectTo(getSafeRedirect());
  }, []);

  const gradeOptions = schoolLevel === "elementary" ? [1, 2, 3, 4, 5, 6] : schoolLevel ? [1, 2, 3] : [];
  const loginHref = useMemo(() => {
    const params = new URLSearchParams();
    if (mode === "parent") params.set("role", "parent");
    if (redirectTo) params.set("redirectTo", redirectTo);
    const query = params.toString();
    return query ? `/login?${query}` : "/login";
  }, [mode, redirectTo]);

  const onSubmit = async () => {
    setError(null);
    setMessage(null);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const trimmedClassLabel = classLabel.trim();

    if (!trimmedEmail || !password || !trimmedName) {
      setError(AUTH_TEXT.invalidInput);
      return;
    }

    if (password !== passwordConfirm) {
      setPasswordError("비밀번호가 일치하지 않아요");
      setError("비밀번호가 일치하지 않아요");
      return;
    }

    if (mode === "student" && (!schoolLevel || !gradeOptions.includes(Number(grade)))) {
      setError(AUTH_TEXT.invalidInput);
      return;
    }

    setLoading(true);
    try {
      // 아카데미 ID 조회 (원장 페이지 필터링에 필수)
      const { data: academyRow } = await supabase
        .from("academies")
        .select("id")
        .limit(1)
        .maybeSingle();
      const academyId = academyRow?.id ?? null;

      const role = mode === "parent" ? "parent" : "student";
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            role,
            name: trimmedName,
          },
        },
      });

      if (
        signUpError &&
        !String(signUpError.message).toLowerCase().includes("already") &&
        !String(signUpError.message).toLowerCase().includes("registered")
      ) {
        throw signUpError;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) throw signInError;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error("user not found");

      const profilePayload =
        mode === "parent"
          ? {
              id: user.id,
              email: user.email ?? trimmedEmail,
              role: "parent",
              account_status: "active",
              name: trimmedName,
              academy_id: academyId,
            }
          : {
              id: user.id,
              email: user.email ?? trimmedEmail,
              role: "student",
              account_status: "pending",
              name: trimmedName,
              school_level: schoolLevel,
              grade: Number(grade),
              class_label: trimmedClassLabel || null,
              academy_id: academyId,
            };

      const { error: profileError } = await supabase.from("profiles").upsert(profilePayload, { onConflict: "id" });
      if (profileError) {
        // Rollback: delete orphan auth account then sign out
        const { data: { session: activeSession } } = await supabase.auth.getSession();
        if (activeSession?.access_token) {
          await fetch("/api/auth/cleanup", {
            method: "POST",
            headers: { Authorization: `Bearer ${activeSession.access_token}` },
          });
        }
        await supabase.auth.signOut();
        throw new Error(`프로필 생성 실패: ${profileError.message}`);
      }

      router.refresh();

      if (mode === "parent") {
        setMessage(AUTH_TEXT.signupSuccessParent);
        setTimeout(() => router.push(redirectTo ?? "/parent"), 600);
        return;
      }

      // 학생: 로그인 상태 유지하고 관심 분야 선택 단계로 이동 (저장 후 자동으로 승인 대기 페이지로)
      setMessage(AUTH_TEXT.signupSuccessStudent);
      setTimeout(() => router.push("/student/onboarding/interests"), 600);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : AUTH_TEXT.signUpLoginFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
        <div className="mx-auto w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
          <h1 className="text-2xl font-semibold text-[var(--text)]">{AUTH_TEXT.signupTitle}</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{AUTH_TEXT.signupSubtitle}</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                mode === "student"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)]"
              }`}
              onClick={() => setMode("student")}
            >
              학생 계정
            </button>
            <button
              type="button"
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                mode === "parent"
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)]"
              }`}
              onClick={() => setMode("parent")}
            >
              학부모 계정
            </button>
          </div>

          {mode === "parent" && (
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-4">
              <p className="text-sm font-semibold text-[var(--text)]">{AUTH_TEXT.signupParentGuideTitle}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{AUTH_TEXT.signupParentGuideDescription}</p>
            </div>
          )}

          <p className="mt-6 text-sm font-medium text-[var(--text)]">
            {mode === "parent" ? AUTH_TEXT.signupParentTitle : AUTH_TEXT.signupStudentOnlyTitle}
          </p>

          <label className="mb-2 mt-3 block text-sm text-[var(--text)]">{AUTH_TEXT.emailLabel}</label>
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={AUTH_TEXT.emailLabel}
          />

          <label className="mb-2 mt-4 block text-sm text-[var(--text)]">{AUTH_TEXT.passwordLabel}</label>
          <input
            type="password"
            autoComplete="new-password"
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
            placeholder={AUTH_TEXT.passwordLabel}
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
            placeholder="비밀번호 다시 입력"
          />
          {passwordError && (
            <p className="mt-1 text-[13px] text-[var(--danger-text)]">⚠️ {passwordError}</p>
          )}
          {!passwordError && password && passwordConfirm && password === passwordConfirm && (
            <p className="mt-1 text-[13px] text-[var(--success-text)]">✅ 비밀번호가 일치해요</p>
          )}

          <label className="mb-2 mt-4 block text-sm text-[var(--text)]">{AUTH_TEXT.nameLabel}</label>
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={AUTH_TEXT.nameLabel}
          />

          {mode === "student" && (
            <>
              <label className="mb-2 mt-4 block text-sm text-[var(--text)]">{AUTH_TEXT.schoolLevelLabel}</label>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                value={schoolLevel}
                onChange={(e) => {
                  const nextLevel = e.target.value as SchoolLevel | "";
                  setSchoolLevel(nextLevel);
                  setGrade(""); // school_level 변경 시 항상 초기화
                }}
              >
                <option value="">{AUTH_TEXT.selectPlaceholder}</option>
                <option value="elementary">초등</option>
                <option value="middle">중등</option>
                <option value="high">고등</option>
              </select>

              <label className="mb-2 mt-4 block text-sm text-[var(--text)]">{AUTH_TEXT.gradeLabel}</label>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-60"
                value={grade}
                onChange={(e) => setGrade(e.target.value ? Number(e.target.value) : "")}
                disabled={!schoolLevel}
              >
                <option value="">{AUTH_TEXT.selectPlaceholder}</option>
                {gradeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>

              <label className="mb-2 mt-4 block text-sm text-[var(--text)]">{AUTH_TEXT.classLabelOptional}</label>
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)]"
                value={classLabel}
                onChange={(e) => setClassLabel(e.target.value)}
                placeholder={AUTH_TEXT.classLabelOptional}
              />
            </>
          )}

          <button
            type="button"
            className="mt-5 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)] disabled:opacity-60"
            onClick={() => void onSubmit()}
            disabled={
              loading ||
              !email ||
              !password ||
              !passwordConfirm ||
              password !== passwordConfirm ||
              !!passwordError
            }
          >
            {loading ? AUTH_TEXT.processing : mode === "parent" ? "학부모 계정 만들기" : AUTH_TEXT.signupSubmitButton}
          </button>

          <Link
            href={loginHref}
            className="mt-3 block text-center text-sm text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)]"
          >
            {AUTH_TEXT.backToLogin}
          </Link>

          {error && (
            <div className="mt-4 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-4 rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] p-3 text-sm text-[var(--success-text)]">
              {message}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
