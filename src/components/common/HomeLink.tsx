"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MvsHeaderLogo from "@/components/brand/MvsHeaderLogo";
import { supabase } from "@/lib/supabaseClient";

type HomeHref = "/owner" | "/student" | "/parent" | "/";

type HomeLinkProps = {
  label?: string;
  className?: string;
  fallbackHref?: HomeHref;
  variant?: "button" | "logo";
};

export default function HomeLink({
  label = "Home",
  className = "",
  fallbackHref = "/",
  variant = "button",
}: HomeLinkProps) {
  const [homeHref, setHomeHref] = useState<HomeHref | null>(null);

  useEffect(() => {
    let mounted = true;

    const resolveHome = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!mounted) return;
      if (sessionError || !session) {
        setHomeHref(fallbackHref);
        return;
      }

      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle<{ role: string | null }>();

      if (!mounted) return;
      if (profileError || !profileRow?.role) {
        setHomeHref(fallbackHref);
        return;
      }

      if (profileRow.role === "owner") {
        setHomeHref("/owner");
      } else if (profileRow.role === "student") {
        setHomeHref("/student");
      } else if (profileRow.role === "parent") {
        setHomeHref("/parent");
      } else {
        setHomeHref(fallbackHref);
      }
    };

    void resolveHome();
    return () => {
      mounted = false;
    };
  }, [fallbackHref]);

  const href = useMemo(() => homeHref ?? fallbackHref, [fallbackHref, homeHref]);

  if (variant === "logo") {
    return (
      <div className={className}>
        <MvsHeaderLogo href={href} size="md" />
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)] ${className}`.trim()}
    >
      {label}
    </Link>
  );
}
