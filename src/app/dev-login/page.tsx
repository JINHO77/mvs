"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PublicHeader from "@/components/common/PublicHeader";
import { AUTH_TEXT } from "@/constants/auth.ko";
import { supabase } from "@/lib/supabaseClient";

export default function DevLoginPage() {
  const router = useRouter();
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";
  const [selectedRole, setSelectedRole] = useState<"student" | "parent" | "staff">("student");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get("role");
    if (role === "parent") {
      setSelectedRole("parent");
      return;
    }
    if (role === "owner" || role === "teacher" || role === "staff") {
      setSelectedRole("staff");
    }
  }, []);

  const signIn = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(AUTH_TEXT.loginFailed);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, account_status")
        .eq("id", user.id)
        .maybeSingle<{ role: string; account_status: string }>();

      if (!profile) {
        await supabase.auth.signOut();
        setMsg("프로필이 없는 계정입니다. 다시 가입해 주세요.");
        return;
      }

      if (profile.account_status === "blocked") {
        await supabase.auth.signOut();
        setMsg("이용이 제한된 계정입니다. 원장님에게 문의해 주세요.");
        return;
      }

      router.refresh();

      if (profile.account_status === "pending") {
        router.push("/pending-approval");
        return;
      }

      const dest =
        profile.role === "student"
          ? "/student"
          : profile.role === "parent"
            ? "/parent"
            : profile.role === "owner"
              ? "/owner"
              : profile.role === "teacher"
                ? "/teacher"
                : "/";
      router.push(dest);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : AUTH_TEXT.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  const sendResetEmail = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMsg(AUTH_TEXT.resetEmailSent);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : AUTH_TEXT.resetEmailFailed);
    } finally {
      setLoading(false);
    }
  };

  if (!devMode) {
    return (
      <>
        <PublicHeader />
        <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
            <p className="text-sm text-[var(--text-muted)]">개발 모드가 비활성화되어 있습니다.</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text)]">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[var(--text)]">{AUTH_TEXT.loginTitle}</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{AUTH_TEXT.devOnlyDescription}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  selectedRole === "student"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                }`}
                onClick={() => setSelectedRole("student")}
              >
                {AUTH_TEXT.roleStudent}
              </button>
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  selectedRole === "parent"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                }`}
                onClick={() => setSelectedRole("parent")}
              >
                {AUTH_TEXT.roleParent}
              </button>
              <button
                type="button"
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  selectedRole === "staff"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                }`}
                onClick={() => setSelectedRole("staff")}
              >
                {AUTH_TEXT.roleStaff}
              </button>
            </div>
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              {selectedRole === "student"
                ? AUTH_TEXT.roleHintStudent
                : selectedRole === "parent"
                  ? AUTH_TEXT.roleHintParent
                  : AUTH_TEXT.roleHintStaff}
            </p>
          </div>

          <label className="mb-2 block text-sm text-[var(--text)]">{AUTH_TEXT.emailLabel}</label>
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={AUTH_TEXT.emailLabel}
          />

          <label className="mb-2 mt-4 block text-sm text-[var(--text)]">{AUTH_TEXT.passwordLabel}</label>
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)]"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={AUTH_TEXT.passwordLabel}
          />

          <button
            className="mt-4 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 font-semibold text-[var(--bg)] disabled:opacity-60"
            onClick={signIn}
            disabled={loading}
          >
            {loading ? AUTH_TEXT.processing : AUTH_TEXT.loginButton}
          </button>

          <Link
            href="/signup"
            className="mt-3 block w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)]"
          >
            {AUTH_TEXT.signUpButton}
          </Link>

          <button
            className="mt-3 text-sm text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)] disabled:opacity-60"
            onClick={sendResetEmail}
            disabled={loading}
          >
            {AUTH_TEXT.resetPasswordLink}
          </button>

          {msg && (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-3 text-sm text-[var(--text)]">
              {msg}
            </div>
          )}

          <div className="mt-4">
            <Link href="/login" className="text-xs text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text)]">
              {AUTH_TEXT.productionDescription}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}