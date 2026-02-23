"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "owner" | "teacher" | "parent" | "student";
type PageState = "loading" | "ready";

const roleButtons: Array<{ role: Role; label: string; description: string }> = [
  { role: "owner", label: "Owner", description: "Manage students and academy operations." },
  { role: "teacher", label: "Teacher", description: "Manage classes and consult operations." },
  { role: "parent", label: "Parent", description: "Link students and request consult slots." },
  { role: "student", label: "Student", description: "Use student profile and dashboard features." },
];

function isValidRole(role: string | null | undefined): role is Role {
  return role === "owner" || role === "teacher" || role === "parent" || role === "student";
}

export default function OnboardingRolePage() {
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(`Session error: ${sessionError.message}`);
      setPageState("ready");
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const uid = session.user.id;
    setUserId(uid);

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", uid)
      .maybeSingle<{ id: string; role: string | null }>();

    if (meError) {
      setError(`Profile error: ${meError.message}`);
      setPageState("ready");
      return;
    }

    if (isValidRole(me?.role)) {
      if (me.role === "student") router.replace("/student/setup");
      else if (me.role === "parent") router.replace("/link-student");
      else router.replace("/owner/students");
      return;
    }

    setPageState("ready");
  };

  const handleSelectRole = async (role: Role) => {
    if (!userId || savingRole) return;
    setError(null);
    setSavingRole(role);
    const { error: updateError } = await supabase.from("profiles").update({ role }).eq("id", userId);
    if (updateError) {
      setError(updateError.message);
      setSavingRole(null);
      return;
    }

    if (role === "student") router.replace("/student/setup");
    else if (role === "parent") router.replace("/link-student");
    else router.replace("/owner/students");
  };

  if (pageState === "loading") {
    return <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">Choose Your Role</h1>
        <p className="mt-2 text-sm text-[#B8B8C3]">Select the role you want to use.</p>
        {error && <div className="mt-4 rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">{error}</div>}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roleButtons.map((item) => {
            const busy = savingRole === item.role;
            return (
              <button
                key={item.role}
                type="button"
                className="rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-4 text-left transition hover:border-[#D4AF37] disabled:opacity-60"
                onClick={() => void handleSelectRole(item.role)}
                disabled={!!savingRole}
              >
                <div className="text-lg font-semibold text-[#F5F5F7]">{item.label}</div>
                <div className="mt-1 text-sm text-[#B8B8C3]">{item.description}</div>
                {busy && <div className="mt-2 text-xs text-[#D4AF37]">Saving...</div>}
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
