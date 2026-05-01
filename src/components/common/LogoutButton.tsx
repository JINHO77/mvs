"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-red-400 hover:text-red-400"
    >
      로그아웃
    </button>
  );
}
