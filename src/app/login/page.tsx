"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const signIn = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      router.replace("/dashboard");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const signUpThenSignIn = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (
        signUpError &&
        !String(signUpError.message).toLowerCase().includes("already") &&
        !String(signUpError.message).toLowerCase().includes("registered")
      ) {
        throw signUpError;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      router.replace("/dashboard");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Signup/login failed.");
    } finally {
      setLoading(false);
    }
  };

  if (process.env.NEXT_PUBLIC_DEV_MODE === "true") {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
          <div className="text-2xl font-semibold">
            <span className="text-[#D4AF37]">MVS</span> Login
          </div>
          <p className="mt-2 text-sm text-[#B8B8C3]">Dev mode allows email/password login.</p>
          <label className="block text-sm mb-2 mt-6 text-[#B8B8C3]">Email</label>
          <input
            className="w-full rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-4 py-3 outline-none focus:ring-2 focus:ring-[#D4AF37]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="block text-sm mt-4 mb-2 text-[#B8B8C3]">Password</label>
          <input
            type="password"
            className="w-full rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-4 py-3 outline-none focus:ring-2 focus:ring-[#D4AF37]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="mt-4 w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-semibold text-black disabled:opacity-60"
            onClick={signIn}
            disabled={loading}
          >
            {loading ? "Processing..." : "Login"}
          </button>
          <button
            className="mt-3 w-full rounded-xl border border-[#1E1E26] bg-transparent px-4 py-3 text-sm text-[#B8B8C3] hover:text-[#F5F5F7]"
            onClick={signUpThenSignIn}
            disabled={loading}
          >
            Create Account + Login
          </button>
          {msg && <div className="mt-4 rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-3 text-sm text-[#B8B8C3]">{msg}</div>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <div className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> Login
        </div>
        <p className="mt-2 text-sm text-[#B8B8C3]">Use your academy account to continue.</p>
      </div>
    </main>
  );
}
