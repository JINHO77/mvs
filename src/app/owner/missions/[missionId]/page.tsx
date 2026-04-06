"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import HomeLink from "@/components/common/HomeLink";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { parseMissionPayload } from "@/lib/missions";

type MissionStatus = "draft" | "review" | "published" | "archived";

type MissionDetail = {
  id: string;
  title: string;
  source_type: "manual" | "ai";
  status: MissionStatus;
  difficulty: "easy" | "normal" | "challenge";
  estimated_minutes: number;
  quality_notes: string | null;
  mission_json: unknown;
  curriculum_units: {
    title: string;
    grade: number;
  } | null;
};

function statusVariant(status: MissionStatus): "neutral" | "warning" | "success" | "danger" {
  if (status === "published") return "success";
  if (status === "review") return "warning";
  if (status === "archived") return "danger";
  return "neutral";
}

export default function OwnerMissionDetailPage() {
  const params = useParams<{ missionId: string }>();
  const router = useRouter();
  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [status, setStatus] = useState<MissionStatus>("draft");
  const [qualityNotes, setQualityNotes] = useState("");

  useEffect(() => {
    void initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.missionId]);

  const initialize = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      setError("미션 상세를 불러오는 중 문제가 발생했습니다.");
      setLoading(false);
      return;
    }
    if (!session) {
      router.replace(isDevMode ? "/dev-login" : "/login");
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single<{ role: string | null }>();

    if (meError || me.role !== "owner") {
      router.replace("/");
      return;
    }

    await loadMission();
  };

  const loadMission = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { data, error: detailError } = await supabase
        .from("generated_missions")
        .select("id,title,source_type,status,difficulty,estimated_minutes,quality_notes,mission_json,curriculum_units(title,grade)")
        .eq("id", params.missionId)
        .single<MissionDetail>();

      if (detailError) throw detailError;
      setMission(data);
      setStatus(data.status);
      setQualityNotes(data.quality_notes ?? "");
    } catch (e: unknown) {
      console.error("Owner mission detail load failed:", toPrettyErrorString(e), e);
      setError("미션 상세를 불러오지 못했습니다.");
      setMission(null);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (nextStatus: MissionStatus) => {
    if (!mission) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const patch: {
        status: MissionStatus;
        reviewed_by?: string | null;
        reviewed_at?: string | null;
        published_at?: string | null;
      } = {
        status: nextStatus,
      };

      if (nextStatus === "review" || nextStatus === "published") {
        patch.reviewed_by = user?.id ?? null;
        patch.reviewed_at = new Date().toISOString();
      }

      if (nextStatus === "published") {
        patch.published_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("generated_missions")
        .update(patch)
        .eq("id", mission.id);

      if (updateError) throw updateError;
      setStatus(nextStatus);
      setSuccess(`상태가 ${nextStatus}로 변경되었습니다.`);
      await loadMission();
    } catch (e: unknown) {
      console.error("Owner mission status update failed:", toPrettyErrorString(e), e);
      setError("상태 변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const saveQualityNotes = async () => {
    if (!mission) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const { error: updateError } = await supabase
        .from("generated_missions")
        .update({ quality_notes: qualityNotes })
        .eq("id", mission.id);
      if (updateError) throw updateError;
      setSuccess("검수 노트를 저장했습니다.");
    } catch (e: unknown) {
      console.error("Owner quality notes save failed:", toPrettyErrorString(e), e);
      setError("검수 노트 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const parsedPayload = mission ? parseMissionPayload(mission.mission_json) : null;

  return (
    <PageShell
      title="미션 상세 검수"
      subtitle="미션 JSON을 확인하고 상태를 업데이트합니다."
      maxWidthClassName="max-w-5xl"
      actions={<HomeLink fallbackHref="/owner" />}
    >
      <SectionCard>
        {loading ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            불러오는 중...
          </div>
        ) : !mission ? (
          <div className="rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">
            {error ?? "미션을 찾을 수 없습니다."}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-[var(--text)]">{mission.title}</h2>
                <Badge variant={statusVariant(status)}>{status}</Badge>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                단원: {mission.curriculum_units?.title ?? "-"} · 학년: {mission.curriculum_units?.grade ?? "-"}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                난이도: {mission.difficulty} · 예상 시간: {mission.estimated_minutes}분 · source: {mission.source_type}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                disabled={saving}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] disabled:opacity-60"
                onClick={() => void updateStatus("review")}
              >
                review로 변경
              </button>
              <button
                type="button"
                disabled={saving}
                className="w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
                onClick={() => void updateStatus("published")}
              >
                published로 변경
              </button>
              <button
                type="button"
                disabled={saving}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] disabled:opacity-60"
                onClick={() => void updateStatus("draft")}
              >
                draft로 되돌리기
              </button>
            </div>

            <label className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-sm font-semibold text-[var(--text)]">Quality notes</p>
              <textarea
                value={qualityNotes}
                onChange={(e) => setQualityNotes(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-3 py-2 text-sm text-[var(--text)] outline-none"
                placeholder="검수 메모를 입력하세요"
              />
              <button
                type="button"
                disabled={saving}
                className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] disabled:opacity-60"
                onClick={() => void saveQualityNotes()}
              >
                노트 저장
              </button>
            </label>

            {error && <div className="rounded-xl border border-[#6A2B2B] bg-[#2A1414] p-3 text-sm text-[#FFB4B4]">{error}</div>}
            {success && <div className="rounded-xl border border-[#1F6B42] bg-[#12281C] p-3 text-sm text-[#B6F0C9]">{success}</div>}

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-sm font-semibold text-[var(--text)]">mission_json 미리보기</p>
              {!parsedPayload ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">유효한 mission_json 형식이 아닙니다.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {parsedPayload.steps.map((step) => (
                    <div key={step.stepOrder} className="rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-3">
                      <p className="text-xs text-[var(--text-muted)]">
                        STEP {step.stepOrder} · {step.stepType}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text)]">{step.title}</p>
                      {step.question && <p className="mt-1 text-xs text-[var(--text-muted)]">{step.question}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}

