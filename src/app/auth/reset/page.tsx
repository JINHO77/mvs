"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState<string | null>("Preparing reset session...");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          setMsg("Checking reset link...");
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setMsg(`Failed to process link: ${error.message}`);
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setMsg("No active session. Open the reset link directly from your email.");
          return;
        }

        setMsg("Enter your new password.");
        setReady(true);
      } catch (e: unknown) {
        setMsg(e instanceof Error ? e.message : "Unknown error");
      }
    })();
  }, []);

  const updatePassword = async () => {
    setMsg(null);
    if (password.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setMsg("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMsg("Password updated. Redirecting to dev login...");
      setTimeout(() => router.replace("/dev-login"), 800);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> Reset Password
        </h1>
        <p className="mt-3 text-sm text-[#B8B8C3]">{msg}</p>

        {ready && (
          <>
            <label className="block text-sm mt-6 mb-2 text-[#B8B8C3]">New Password</label>
            <input
              className="w-full rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-4 py-3 outline-none focus:ring-2 focus:ring-[#D4AF37]"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <label className="block text-sm mt-4 mb-2 text-[#B8B8C3]">Confirm Password</label>
            <input
              className="w-full rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-4 py-3 outline-none focus:ring-2 focus:ring-[#D4AF37]"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
            />
            <button
              className="mt-5 w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-semibold text-black disabled:opacity-60"
              onClick={updatePassword}
              disabled={saving}
            >
              {saving ? "Saving..." : "Update Password"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
