import { redirect } from "next/navigation";
import GenerateProjectButton from "@/components/GenerateProjectButton";
import { formatDate, textOrDash } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { HandoverJob } from "@/lib/types";

const detailSections: Array<{ title: string; fields: Array<[keyof HandoverJob, string]> }> = [
  {
    title: "A. 업체/조직 정보",
    fields: [
      ["organization_name", "업체/조직명"],
      ["industry", "업종"],
      ["organization_context", "조직/업무 환경 설명"],
    ],
  },
  {
    title: "B. 직무 기본 정보",
    fields: [
      ["job_title", "인수인계할 직무명"],
      ["department", "부서/역할"],
      ["trainee_level", "교육 대상 수준"],
      ["training_days", "교육 기간"],
      ["job_importance", "이 직무가 중요한 이유"],
    ],
  },
  {
    title: "C. 실제 업무 설명",
    fields: [
      ["daily_workflow", "하루 업무 흐름"],
      ["main_tasks", "반복적으로 하는 주요 업무"],
      ["critical_tasks", "실수하면 큰 문제가 되는 업무"],
      ["required_tools", "자주 사용하는 도구/문서/시스템"],
    ],
  },
  {
    title: "D. 인수인계 핵심 내용",
    fields: [
      ["handover_rules", "핵심 규칙"],
      ["do_not_do", "절대 하면 안 되는 행동"],
      ["common_mistakes", "신입자가 자주 하는 실수"],
    ],
  },
  {
    title: "E. 문제 상황과 교육 목표",
    fields: [
      ["common_situations", "자주 발생하는 곤란한 상황"],
      ["success_criteria", "일을 잘한다는 기준"],
      ["final_goal", "교육 후 최종 목표"],
    ],
  },
];

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: job, error } = await supabase
    .from("handover_jobs")
    .select("*")
    .eq("id", id)
    .single<HandoverJob>();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm leading-6 text-red-700">
        인수인계 상세 정보를 불러오지 못했습니다. 로그인 사용자와 owner_id가 일치하는지,
        handover_jobs select RLS 정책을 확인해주세요. 상세: {error.message}
      </div>
    );
  }

  if (!job) redirect("/jobs");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-white p-6">
        <div>
          <p className="text-sm text-muted">{job.organization_name}</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">{job.job_title}</h1>
          <p className="mt-2 text-sm text-muted">
            상태 {job.status ?? "draft"} · 생성일 {formatDate(job.created_at)}
          </p>
        </div>
        <GenerateProjectButton jobId={job.id} />
      </div>

      {detailSections.map((section) => (
        <section key={section.title} className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
          <div className="mt-5 grid gap-4">
            {section.fields.map(([key, label]) => (
              <div key={key} className="rounded-md bg-paper p-4">
                <p className="text-sm font-medium text-muted">{label}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                  {key === "training_days" && job[key] ? `${job[key]}일` : textOrDash(job[key])}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
