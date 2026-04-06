"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Badge from "@/components/ui/Badge";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { fetchCurriculumUnits, fetchMissionProgressMap, fetchPublishedMissionsByUnit } from "@/lib/missions";
import { toPrettyErrorString } from "@/lib/supabaseError";
import type { MissionProgressSummary } from "@/lib/missions";
import type { CurriculumUnit, GeneratedMission } from "@/types/missions";

function difficultyLabel(difficulty: GeneratedMission["difficulty"]): string {
  if (difficulty === "easy") return "쉬움";
  if (difficulty === "challenge") return "도전";
  return "보통";
}

function difficultyVariant(difficulty: GeneratedMission["difficulty"]): "success" | "warning" | "danger" {
  if (difficulty === "easy") return "success";
  if (difficulty === "challenge") return "danger";
  return "warning";
}

function statusText(progress?: MissionProgressSummary): string {
  if (!progress || progress.status === "not_started") return "아직 시작 전";
  if (progress.status === "completed") return "완료";
  const total = progress.totalSteps > 0 ? progress.totalSteps : "-";
  return `진행중 · ${progress.lastStep}/${total} 단계`;
}

function statusBadge(progress?: MissionProgressSummary): { label: string; variant: "neutral" | "info" | "success" } {
  if (!progress || progress.status === "not_started") {
    return { label: "시작 전", variant: "neutral" };
  }
  if (progress.status === "completed") {
    return { label: "완료", variant: "success" };
  }
  return { label: "진행중", variant: "info" };
}

export default function StudentMathUnitPage() {
  const params = useParams<{ unitId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<CurriculumUnit | null>(null);
  const [missions, setMissions] = useState<GeneratedMission[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, MissionProgressSummary>>({});

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const unitId = params.unitId;
        const [units, missionRows] = await Promise.all([fetchCurriculumUnits(), fetchPublishedMissionsByUnit(unitId)]);
        const foundUnit = units.find((row) => row.id === unitId) ?? null;

        if (!mounted) return;
        if (!foundUnit) {
          setUnit(null);
          setMissions([]);
          setProgressMap({});
          setError("단원을 찾을 수 없습니다.");
          return;
        }

        const missionProgress = await fetchMissionProgressMap(
          missionRows.map((mission) => mission.id),
          Object.fromEntries(missionRows.map((mission) => [mission.id, mission.mission_json.steps.length]))
        );
        if (!mounted) return;

        setUnit(foundUnit);
        setMissions(missionRows);
        setProgressMap(missionProgress);
      } catch (e: unknown) {
        console.error("Student math unit load failed:", toPrettyErrorString(e), e);
        if (!mounted) return;
        setError("단원 정보를 불러오지 못했습니다.");
        setUnit(null);
        setMissions([]);
        setProgressMap({});
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [params.unitId]);

  return (
    <PageShell
      title={unit?.unit_name ?? "단원 미션"}
      subtitle={unit?.description ?? "단원별 미션을 골라 학습을 진행하세요."}
      maxWidthClassName="max-w-5xl"
    >
      <SectionCard header="개념 설명" description={unit?.concept_summary ?? "핵심 개념을 먼저 확인하고 미션을 풀어보세요."} />

      <SectionCard header="미션 목록" description="난이도와 예상 시간을 확인하고 시작할 수 있습니다.">
        {loading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            불러오는 중...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">{error}</div>
        ) : missions.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">
            이 단원에 공개된 미션이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((mission) => {
              const missionStatusBadge = statusBadge(progressMap[mission.id]);
              return (
                <Link
                  key={mission.id}
                  href={`/student/math/mission/${mission.id}`}
                  className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{mission.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={missionStatusBadge.variant}>{missionStatusBadge.label}</Badge>
                      <Badge variant={difficultyVariant(mission.difficulty)}>{difficultyLabel(mission.difficulty)}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{mission.mission_json.scenario}</p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    예상 시간: {mission.estimated_minutes}분 · {statusText(progressMap[mission.id])}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
