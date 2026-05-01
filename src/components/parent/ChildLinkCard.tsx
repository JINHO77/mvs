"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Relation = "parent" | "guardian" | "other";

type RedeemResponse = {
  success?: boolean;
  student_id?: string;
  student_name?: string;
  relation?: string;
  already_linked?: boolean;
  error?: string;
};

type LinkedChildRow = {
  student_id: string;
  relation: string | null;
  profiles: {
    name: string | null;
    school_level: string | null;
    grade: number | null;
  } | null;
};

function relationLabel(relation: string | null | undefined): string {
  switch (relation) {
    case "parent":
      return "부모";
    case "mother":
      return "어머니";
    case "father":
      return "아버지";
    case "guardian":
      return "보호자";
    case "other":
      return "기타";
    default:
      return "보호자";
  }
}

function gradeLabel(schoolLevel: string | null | undefined, grade: number | null | undefined): string {
  if (!schoolLevel || grade == null) return "";
  if (schoolLevel === "elementary") return `초${grade}`;
  if (schoolLevel === "middle") return `중${grade}`;
  if (schoolLevel === "high") return `고${grade}`;
  return String(grade);
}

export default function ChildLinkCard({
  guardianId,
  onLinked,
  variant = "compact",
}: {
  guardianId: string;
  onLinked?: () => void;
  variant?: "compact" | "primary";
}) {
  const [code, setCode] = useState("");
  const [relation, setRelation] = useState<Relation>("parent");
  const [submitting, setSubmitting] = useState(false);
  const [linkedChildren, setLinkedChildren] = useState<LinkedChildRow[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!guardianId) return;
    void loadChildren();
  }, [guardianId]);

  const loadChildren = async () => {
    const { data, error } = await supabase
      .from("student_guardians")
      .select("student_id, relation, profiles:profiles!student_id(name, school_level, grade)")
      .eq("guardian_id", guardianId);
    if (error) {
      console.warn("[ChildLinkCard] load children failed", error);
      return;
    }
    setLinkedChildren((data ?? []) as unknown as LinkedChildRow[]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setMessage({ type: "error", text: "코드는 6자리예요" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("redeem_guardian_invitation", {
        p_guardian_id: guardianId,
        p_invitation_code: trimmed,
        p_relation: relation,
      });
      if (error) throw error;

      const result = data as RedeemResponse | null;
      if (result?.success) {
        const studentName = result.student_name ?? "자녀";
        setMessage({
          type: "success",
          text: result.already_linked
            ? `${studentName}님은 이미 연결되어 있어요`
            : `${studentName}님과 연결됐어요!`,
        });
        setCode("");
        await loadChildren();
        onLinked?.();
      } else {
        setMessage({ type: "error", text: result?.error ?? "연결에 실패했어요." });
      }
    } catch (e: unknown) {
      console.error("[ChildLinkCard] redeem failed", e);
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "일시적 오류가 발생했어요.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isPrimary = variant === "primary";

  return (
    <div className="space-y-4">
      {linkedChildren.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-[var(--text-muted)]">연결된 자녀</p>
          <div className="space-y-1.5">
            {linkedChildren.map((c) => {
              const grade = gradeLabel(c.profiles?.school_level, c.profiles?.grade);
              return (
                <div
                  key={c.student_id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]"
                >
                  <div className="font-semibold">{c.profiles?.name ?? "자녀"}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {[grade, relationLabel(c.relation)].filter(Boolean).join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
        <p className="text-sm text-[var(--text-muted)]">
          {isPrimary
            ? "자녀가 마이페이지에서 받은 6자리 코드를 입력하세요."
            : "자녀가 알려준 6자리 코드를 입력하세요."}
        </p>

        <input
          type="text"
          value={code}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            setCode(v.slice(0, 6));
          }}
          placeholder="예: K7M3PQ"
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect="off"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />

        <label className="block">
          <span className="mb-1 block text-xs text-[var(--text-muted)]">관계</span>
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value as Relation)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="parent">부모</option>
            <option value="guardian">보호자</option>
            <option value="other">기타</option>
          </select>
        </label>

        {message && (
          <p
            className={`text-[13px] ${
              message.type === "success" ? "text-[var(--success-text)]" : "text-[var(--danger-text)]"
            }`}
          >
            {message.type === "success" ? "✅" : "⚠️"} {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={code.length !== 6 || submitting}
          className="w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
        >
          {submitting ? "연결 중..." : "자녀 연결하기"}
        </button>
      </form>
    </div>
  );
}
