"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabaseClient";

type CreateInvitationResponse = {
  success?: boolean;
  invitation_code?: string;
  expires_at?: string;
  reused?: boolean;
  error?: string;
};

type LinkedGuardianRow = {
  guardian_id: string;
  relation: string | null;
  profiles: { name: string | null; email: string | null } | null;
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

function formatExpiry(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function buildLinkUrl(code: string): string {
  const path = `/parent/onboarding/link?code=${encodeURIComponent(code)}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export default function GuardianInvitationCard({ studentId }: { studentId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [linkedGuardians, setLinkedGuardians] = useState<LinkedGuardianRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    void loadGuardians();
    void loadExistingCode();
  }, [studentId]);

  const loadGuardians = async () => {
    const { data, error: rowsError } = await supabase
      .from("student_guardians")
      .select("guardian_id, relation, profiles:profiles!guardian_id(name, email)")
      .eq("student_id", studentId);
    if (rowsError) {
      console.warn("[GuardianInvitationCard] load guardians failed", rowsError);
      return;
    }
    setLinkedGuardians((data ?? []) as unknown as LinkedGuardianRow[]);
  };

  const loadExistingCode = async () => {
    const { data, error: codeError } = await supabase
      .from("guardian_invitations")
      .select("invitation_code, expires_at")
      .eq("student_id", studentId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ invitation_code: string; expires_at: string }>();
    if (codeError) {
      console.warn("[GuardianInvitationCard] load existing code failed", codeError);
      return;
    }
    if (data) {
      setCode(data.invitation_code);
      setExpiresAt(data.expires_at);
    }
  };

  const handleGenerateCode = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("create_guardian_invitation", {
        p_student_id: studentId,
      });
      if (rpcError) throw rpcError;
      const result = data as CreateInvitationResponse | null;
      if (result?.success && result.invitation_code && result.expires_at) {
        setCode(result.invitation_code);
        setExpiresAt(result.expires_at);
      } else {
        setError(result?.error ?? "코드 발급에 실패했어요.");
      }
    } catch (e: unknown) {
      console.error("[GuardianInvitationCard] generate failed", e);
      setError(e instanceof Error ? e.message : "일시적 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.warn("[GuardianInvitationCard] clipboard failed", e);
    }
  };

  return (
    <div className="space-y-4">
      {linkedGuardians.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-[var(--text-muted)]">연결된 보호자</p>
          <div className="space-y-1.5">
            {linkedGuardians.map((g) => (
              <div
                key={g.guardian_id}
                className="rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--text)]"
              >
                ✅ {g.profiles?.name ?? "보호자"} ({relationLabel(g.relation)})
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          부모님께 코드를 알려주세요. 부모님이 ''자녀 연결''에서 입력하면 자동으로 연결돼요.
        </p>

        {code ? (
          <div className="space-y-2">
            <div className="rounded-2xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-5 text-center">
              <div className="font-mono text-3xl font-bold tracking-[0.4em] text-[var(--accent)]">
                {code}
              </div>
              {expiresAt && (
                <div className="mt-2 text-xs text-[var(--text-muted)]">
                  {formatExpiry(expiresAt)}까지 사용 가능
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)]"
              >
                {copied ? "✅ 복사됐어요!" : "📋 코드 복사"}
              </button>
              <button
                type="button"
                onClick={() => setShowQR(true)}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)]"
              >
                📱 QR 보기
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleGenerateCode()}
            disabled={loading}
            className="w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
          >
            {loading ? "발급 중..." : "✨ 보호자 초대 코드 받기"}
          </button>
        )}

        {error && (
          <p className="mt-2 text-[13px] text-[var(--danger-text)]">⚠️ {error}</p>
        )}
      </div>

      {showQR && code && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,11,20,0.82)] p-4"
          onClick={() => setShowQR(false)}
        >
          <div
            className="w-full max-w-md rounded-[30px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <h2 className="text-xl font-semibold text-[var(--text)]">보호자 연결 QR</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                부모님이 이 QR을 스캔하면 자동으로 연결 화면으로 이동해요.
              </p>
            </div>

            <div className="mt-6 rounded-[28px] border border-[var(--border)] bg-white p-5">
              <div className="mx-auto w-full max-w-[280px]">
                <QRCode
                  value={buildLinkUrl(code)}
                  size={280}
                  style={{ width: "100%", height: "auto" }}
                  viewBox="0 0 256 256"
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-center">
              <div className="text-xs text-[var(--text-muted)]">초대 코드</div>
              <div className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-[var(--accent)]">
                {code}
              </div>
              {expiresAt && (
                <div className="mt-2 text-xs text-[var(--text-muted)]">
                  {formatExpiry(expiresAt)}까지 사용 가능 · 발급일로부터 7일
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)]"
              >
                {copied ? "✅ 복사됐어요!" : "코드 복사"}
              </button>
              <button
                type="button"
                onClick={() => setShowQR(false)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)]"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
