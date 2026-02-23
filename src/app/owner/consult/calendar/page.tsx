"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function OwnerConsultCalendarPage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError(`Session check failed: ${sessionError.message}`);
        setLoading(false);
        return;
      }

      if (!session) {
        router.replace(isDevMode ? "/dev-login" : "/login");
        return;
      }

      const { data: me, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single<{ role: string }>();

      if (roleError) {
        setError(`Role check failed: ${roleError.message}`);
        setLoading(false);
        return;
      }

      if (me.role !== "owner" && me.role !== "teacher") {
        router.replace("/");
        return;
      }

      setLoading(false);
    })();
  }, [isDevMode, router]);

  if (loading) {
    return <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> Consult Calendar
        </h1>
        {error ? (
          <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">{error}</div>
        ) : (
          <div className="mt-4 rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-sm text-[#B8B8C3]">
            Calendar module is temporarily unavailable.
          </div>
        )}
        <Link
          href="/owner/consult/requests"
          className="mt-4 inline-block rounded-xl border border-[#1E1E26] px-4 py-2 text-sm text-[#B8B8C3] hover:text-[#F5F5F7]"
        >
          Go to request list
        </Link>
      </div>
    </main>
  );
}
