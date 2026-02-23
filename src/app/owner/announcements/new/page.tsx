"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function NewAnnouncementPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialize = async () => {
    setError(null);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setError(`\uC138\uC158 \uD655\uC778 \uC2E4\uD328: ${sessionError.message}`);
      setLoading(false);
      return;
    }

    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const uid = session.user.id;

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .single<{ role: string }>();

    if (meError) {
      setError(`\uAD8C\uD55C \uD655\uC778 \uC2E4\uD328: ${meError.message}`);
      setLoading(false);
      return;
    }

    if (!me || (me.role !== "owner" && me.role !== "teacher")) {
      router.replace("/");
      return;
    }

    setLoading(false);
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);

    const t = title.trim();
    const b = body.trim();

    if (!t || !b) {
      setError("\uC81C\uBAA9\uACFC \uB0B4\uC6A9\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        setError("\uB85C\uADF8\uC778 \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.");
        return;
      }

      const { error: insertError } = await supabase.from("announcements").insert({
        title: t,
        body: b,
        created_by: user.id,
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setTitle("");
      setBody("");
      setSuccess("\uACF5\uC9C0\uC0AC\uD56D\uC774 \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      setTimeout(() => {
        router.replace("/announcements");
      }, 500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "\uACF5\uC9C0 \uB4F1\uB85D \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        {"\uB85C\uB529 \uC911..."}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> {"\uACF5\uC9C0 \uB4F1\uB85D"}
        </h1>

        {error && (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-xl border border-[#2B6A3A] bg-[#142A1B] p-3 text-sm text-[#B8F5C6]">
            {success} <Link href="/announcements" className="underline">{"\uACF5\uC9C0 \uBAA9\uB85D\uC73C\uB85C \uC774\uB3D9"}</Link>
          </div>
        )}

        <label className="block text-sm mt-6 mb-2 text-[#B8B8C3]">{"\uC81C\uBAA9"}</label>
        <input
          className="w-full rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-4 py-3 outline-none focus:ring-2 focus:ring-[#D4AF37]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder={"\uC81C\uBAA9\uC744 \uC785\uB825\uD558\uC138\uC694"}
        />

        <label className="block text-sm mt-4 mb-2 text-[#B8B8C3]">{"\uB0B4\uC6A9"}</label>
        <textarea
          className="min-h-40 w-full rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-4 py-3 outline-none focus:ring-2 focus:ring-[#D4AF37]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"\uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694"}
        />

        <button
          className="mt-5 w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-semibold text-black disabled:opacity-60"
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? "\uB4F1\uB85D \uC911..." : "\uACF5\uC9C0 \uB4F1\uB85D"}
        </button>
      </div>
    </main>
  );
}
