"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import PageShell from "@/components/ui/PageShell";
import SectionCard from "@/components/ui/SectionCard";
import { fetchCurriculumUnitsBySubject, fetchMissionProgressMap, fetchPublishedMissionsByUnit, type MissionProgressSummary } from "@/lib/missions";
import { toPrettyErrorString } from "@/lib/supabaseError";
import { normalizeUiText } from "@/lib/uiText";
import type { CurriculumUnit, GeneratedMission } from "@/types/missions";

const ENGLISH_UNIT_COPY = {
  pageTitle: "영어 단원",
  pageSubtitle: "상황을 이해하고 표현을 연습할 수 있는 영어 미션을 골라 보세요.",
  overviewTitle: "상황과 표현",
  overviewDescription: "읽기와 표현 과업으로 단원의 흐름을 차근차근 보세요.",
  missionListTitle: "영어 미션 목록",
  missionListDescription: "현재 학습 상태를 보고 바로 시작할 수 있어요.",
  loading: "불러오는 중...",
  empty: "이 단원에 공개된 영어 미션이 아직 없어요.",
  errorNotFound: "영어 단원을 찾을 수 없어요.",
  errorLoad: "영어 단원 정보를 불러오지 못했어요.",
  firstStart: "처음 시작",
  revisit: "다시 보기",
  continueStudy: "이어서 하기",
  scenarioFallback: "일상 상황에서 영어를 이해하고 표현해 볼 수 있어요.",
  easy: "쉬움",
  normal: "보통",
  challenge: "도전",
  expected: "예상",
  minute: "분",
} as const;

function displayText(value: unknown, fallback = ""): string {
  const text = normalizeUiText(value);
  return text || fallback;
}

function difficultyLabel(difficulty: GeneratedMission["difficulty"]): string {
  if (difficulty === "easy") return ENGLISH_UNIT_COPY.easy;
  if (difficulty === "challenge") return ENGLISH_UNIT_COPY.challenge;
  return ENGLISH_UNIT_COPY.normal;
}

function statusText(progress?: MissionProgressSummary): string {
  if (!progress || progress.status === "not_started") return ENGLISH_UNIT_COPY.firstStart;
  if (progress.status === "completed") return ENGLISH_UNIT_COPY.revisit;
  return ENGLISH_UNIT_COPY.continueStudy;
}

function displayEstimatedMinutes(minutes?: number | null): number {
  if (!minutes) return 7;
  if (minutes >= 15) return 9;
  if (minutes >= 13) return 8;
  if (minutes >= 11) return 7;
  if (minutes >= 9) return 6;
  return Math.max(5, minutes);
}

export default function StudentEnglishUnitPage() {
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
        const [units, missionRows] = await Promise.all([
          fetchCurriculumUnitsBySubject("english"),
          fetchPublishedMissionsByUnit(unitId, "english"),
        ]);
        const foundUnit = units.find((row) => row.id === unitId) ?? null;

        if (!foundUnit) {
          if (!mounted) return;
          setError(ENGLISH_UNIT_COPY.errorNotFound);
          setUnit(null);
          setMissions([]);
          setProgressMap({});
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
      } catch (loadError) {
        console.error("student english unit load failed", toPrettyErrorString(loadError), loadError);
        if (!mounted) return;
        setError(ENGLISH_UNIT_COPY.errorLoad);
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
      title={displayText(unit?.unit_name, ENGLISH_UNIT_COPY.pageTitle)}
      subtitle={displayText(unit?.description, ENGLISH_UNIT_COPY.pageSubtitle)}
      maxWidthClassName="max-w-5xl"
    >
      <SectionCard
        header={displayText(ENGLISH_UNIT_COPY.overviewTitle)}
        description={displayText(unit?.concept_summary, ENGLISH_UNIT_COPY.overviewDescription)}
      />

      <SectionCard header={displayText(ENGLISH_UNIT_COPY.missionListTitle)} description={displayText(ENGLISH_UNIT_COPY.missionListDescription)}>
        {loading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{displayText(ENGLISH_UNIT_COPY.loading)}</div>
        ) : error ? (
          <div className="rounded-2xl border border-[#6A2B2B] bg-[#2A1414] p-4 text-sm text-[#FFB4B4]">{displayText(error)}</div>
        ) : missions.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-soft)] p-4 text-sm text-[var(--text-muted)]">{displayText(ENGLISH_UNIT_COPY.empty)}</div>
        ) : (
          <div className="space-y-3">
            {missions.map((mission) => (
              <Link key={mission.id} href={`/student/english/mission/${mission.id}`} className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text)]">{displayText(mission.title)}</h3>
                  <Badge variant="neutral">{displayText(statusText(progressMap[mission.id]))}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">
                  {displayText(mission.mission_json.scenario, ENGLISH_UNIT_COPY.scenarioFallback)}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">{`${difficultyLabel(mission.difficulty)} · ${ENGLISH_UNIT_COPY.expected} ${displayEstimatedMinutes(mission.estimated_minutes)}${ENGLISH_UNIT_COPY.minute}`}</p>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}
