import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import type { HandoverJob } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { count: jobsCount, error: jobsCountError },
    { count: projectsCount, error: projectsCountError },
    { data: recentJobs, error: recentJobsError },
  ] = await Promise.all([
    supabase.from("handover_jobs").select("*", { count: "exact", head: true }),
    supabase.from("handover_projects").select("*", { count: "exact", head: true }),
    supabase
      .from("handover_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3)
      .returns<HandoverJob[]>(),
  ]);
  const dashboardError = jobsCountError || projectsCountError || recentJobsError;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-ink">대시보드</h1>
          <p className="mt-2 text-sm text-muted">입력한 업무와 생성된 인수인계 프로젝트를 확인합니다.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/jobs/new" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
            새 인수인계 만들기
          </Link>
          <Link href="/jobs?sample=1" className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink">
            샘플 보기
          </Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-6">
          <p className="text-sm text-muted">전체 인수인계 직무 수</p>
          <p className="mt-3 text-4xl font-bold text-ink">{jobsCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-6">
          <p className="text-sm text-muted">생성된 프로젝트 수</p>
          <p className="mt-3 text-4xl font-bold text-ink">{projectsCount ?? 0}</p>
        </div>
      </section>

      {dashboardError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          대시보드 데이터를 불러오지 못했습니다. Supabase 테이블과 RLS select 정책을 확인해주세요.
          상세: {dashboardError.message}
        </div>
      ) : null}

      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="text-xl font-semibold text-ink">최근 생성한 job 3개</h2>
        <div className="mt-4 divide-y divide-line">
          {(recentJobs ?? []).length === 0 ? (
            <p className="py-6 text-sm text-muted">아직 저장된 인수인계 직무가 없습니다.</p>
          ) : (
            recentJobs?.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="block py-4 hover:bg-paper">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{job.job_title}</p>
                    <p className="text-sm text-muted">
                      {job.organization_name} · {job.industry || "업종 미입력"}
                    </p>
                  </div>
                  <p className="text-sm text-muted">{formatDate(job.created_at)}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
