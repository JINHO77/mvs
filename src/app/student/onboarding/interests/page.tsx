"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import { interestTagOptions, type InterestTagKey } from "@/constants/interestTags";
import { supabase } from "@/lib/supabaseClient";

type DbCategory = {
  key: string;
  label: string;
  emoji: string | null;
  description?: string | null;
  display_order?: number | null;
};

type Category = {
  key: string;
  label: string;
  emoji: string;
};

const MIN_SELECTION = 3;
const MAX_SELECTION = 5;

const FALLBACK_CATEGORIES: Category[] = interestTagOptions.map((opt) => ({
  key: opt.key,
  label: opt.label,
  emoji: opt.emoji,
}));

type PageState = "loading" | "ready";

export default function StudentInterestsOnboardingPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace(process.env.NEXT_PUBLIC_DEV_MODE === "true" ? "/dev-login" : "/login");
        return;
      }

      const [catRes, profRes] = await Promise.all([
        supabase
          .from("interest_categories")
          .select("key,label,emoji,description,display_order")
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("profiles")
          .select("interest_tags,role")
          .eq("id", session.user.id)
          .maybeSingle<{ interest_tags: string[] | null; role: string | null }>(),
      ]);

      if (!mounted) return;

      if (profRes.data?.role && profRes.data.role !== "student") {
        router.replace("/");
        return;
      }

      if (!catRes.error && Array.isArray(catRes.data) && catRes.data.length > 0) {
        const mapped: Category[] = (catRes.data as DbCategory[]).map((row) => ({
          key: row.key,
          label: row.label,
          emoji: row.emoji ?? "",
        }));
        setCategories(mapped);
      }

      const existing = Array.isArray(profRes.data?.interest_tags) ? profRes.data!.interest_tags! : [];
      if (existing.length > 0) {
        setSelected(existing.slice(0, MAX_SELECTION));
      }

      setPageState("ready");
    };

    void init();
    return () => {
      mounted = false;
    };
  }, [router]);

  const toggle = (key: string) => {
    setError(null);
    setInfo(null);
    setSelected((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }
      if (prev.length >= MAX_SELECTION) {
        setError(`최대 ${MAX_SELECTION}개까지 선택할 수 있어요.`);
        return prev;
      }
      return [...prev, key];
    });
  };

  const remaining = Math.max(0, MIN_SELECTION - selected.length);
  const buttonLabel = useMemo(() => {
    if (isSaving) return "저장 중...";
    if (selected.length < MIN_SELECTION) return `${remaining}개 더 선택해주세요`;
    return "시작하기 🚀";
  }, [isSaving, selected.length, remaining]);

  const handleSave = async () => {
    if (selected.length < MIN_SELECTION) {
      setError(`최소 ${MIN_SELECTION}개를 선택해주세요.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    setInfo(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("update_my_interests", {
        p_interests: selected,
      });

      if (rpcError) throw rpcError;

      const result = data as { success?: boolean; error?: string } | null;
      if (result?.success) {
        router.replace("/student");
        return;
      }

      setError(result?.error ?? "저장에 실패했어요. 잠시 후 다시 시도해주세요.");
    } catch (err: unknown) {
      console.error("update_my_interests failed", err);
      const message = err instanceof Error ? err.message : "일시적 오류가 발생했어요.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (pageState === "loading") {
    return (
      <PageShell maxWidthClassName="max-w-3xl">
        <p className="text-sm text-[var(--text-muted)]">로딩 중...</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="🎯 어떤 분야에 관심이 있어요?"
      subtitle={`관심 분야를 선택하면 좋아할 만한 미션을 추천해드릴게요. ${MIN_SELECTION}~${MAX_SELECTION}개 선택해주세요.`}
      maxWidthClassName="max-w-3xl"
    >
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-center text-sm text-[var(--text)]">
        선택: <strong className="text-[var(--accent)]">{selected.length}</strong> / {MAX_SELECTION}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {categories.map((cat) => {
          const isSelected = selected.includes(cat.key);
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => toggle(cat.key)}
              aria-pressed={isSelected}
              className={`flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-3 py-5 text-sm font-semibold transition ${
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--accent)]/60"
              }`}
            >
              <span className="text-3xl leading-none" aria-hidden>
                {cat.emoji}
              </span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger-text)]">
          ⚠️ {error}
        </div>
      )}

      {info && (
        <div className="rounded-xl border border-[var(--success-text)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success-text)]">
          {info}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={selected.length < MIN_SELECTION || isSaving}
        className="w-full rounded-2xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-base font-semibold text-[var(--bg)] transition disabled:opacity-50"
      >
        {buttonLabel}
      </button>

      <button
        type="button"
        onClick={() => router.replace("/student")}
        disabled={isSaving}
        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition hover:border-[var(--accent)]/60 hover:text-[var(--text)] disabled:opacity-50"
      >
        나중에 하기
      </button>

      <p className="text-center text-xs text-[var(--text-muted)]">
        나중에 마이페이지에서 변경할 수 있어요.
      </p>
    </PageShell>
  );
}
