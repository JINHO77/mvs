import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { HandoverJob } from "@/lib/types";

const sampleJobs: HandoverJob[] = [
  {
    id: "sample",
    owner_id: "sample",
    organization_name: "해봄 영어수학 학원",
    industry: "교육",
    organization_context: "학부모 상담, 결석/보강 관리, 수강료 안내가 자주 발생하는 초중고 학원입니다.",
    job_title: "학원 운영 매니저",
    department: "운영팀",
    trainee_level: "beginner",
    training_days: 5,
    job_importance: null,
    daily_workflow: null,
    main_tasks: null,
    critical_tasks: null,
    handover_rules: null,
    do_not_do: null,
    common_mistakes: null,
    common_situations: null,
    required_tools: null,
    success_criteria: null,
    final_goal: null,
    status: "sample",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ sample?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("handover_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<HandoverJob[]>();

  const jobs = params.sample === "1" && (!data || data.length === 0) ? sampleJobs : data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink">인수인계 직무 목록</h1>
          <p className="mt-2 text-sm text-muted">저장한 업무 정보를 카드로 확인합니다.</p>
        </div>
        <Link href="/jobs/new" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
          새 인수인계 만들기
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm leading-6 text-red-700">
            인수인계 목록을 불러오지 못했습니다. handover_jobs 테이블과 RLS select 정책을 확인해주세요.
            상세: {error.message}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-6">
            <p className="text-sm text-muted">아직 저장된 인수인계 직무가 없습니다.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <article key={job.id} className="rounded-lg border border-line bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-ink">{job.job_title}</h2>
                  <p className="mt-2 text-sm text-muted">{job.organization_name}</p>
                </div>
                <span className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-muted">{job.status}</span>
              </div>
              <dl className="mt-5 grid gap-3 text-sm text-muted">
                <div className="flex justify-between gap-4">
                  <dt>업종</dt>
                  <dd className="text-right text-ink">{job.industry || "-"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>교육 기간</dt>
                  <dd className="text-right text-ink">{job.training_days ?? 5}일</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>생성일</dt>
                  <dd className="text-right text-ink">{formatDate(job.created_at)}</dd>
                </div>
              </dl>
              {job.id === "sample" ? (
                <p className="mt-5 text-sm text-muted">샘플 카드는 저장된 데이터가 없을 때만 보여주는 예시입니다.</p>
              ) : (
                <Link
                  href={`/jobs/${job.id}`}
                  className="mt-5 inline-flex rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink"
                >
                  상세 보기
                </Link>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
