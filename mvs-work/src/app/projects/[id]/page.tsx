import Link from "next/link";
import { redirect } from "next/navigation";
import GeneratedSection from "@/components/GeneratedSection";
import { createClient } from "@/lib/supabase/server";
import type { HandoverProject } from "@/lib/types";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project, error } = await supabase
    .from("handover_projects")
    .select("*")
    .eq("id", id)
    .single<HandoverProject>();

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm leading-6 text-red-700">
        생성된 프로젝트를 불러오지 못했습니다. 로그인 사용자와 owner_id가 일치하는지,
        handover_projects select RLS 정책을 확인해주세요. 상세: {error.message}
      </div>
    );
  }

  if (!project) redirect("/jobs");

  const generated = project.generated_json ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-white p-6">
        <div>
          <p className="text-sm text-muted">생성된 인수인계 프로젝트</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">{project.title}</h1>
          {project.summary ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{project.summary}</p> : null}
        </div>
        <Link
          href={`/projects/${project.id}/run`}
          className="rounded-md bg-mint px-5 py-3 text-sm font-semibold text-white"
        >
          훈련 실행하기
        </Link>
      </div>

      <GeneratedSection title="업무 파악" value={generated.jobUnderstanding} />
      <GeneratedSection title="업무 흐름" value={generated.workflow} />
      <GeneratedSection title="인수인계 매뉴얼" value={generated.handoverManual} />
      <GeneratedSection title="체크리스트" value={generated.checklists} />
      <GeneratedSection title="훈련 프로젝트" value={generated.trainingProjects} />
      <GeneratedSection title="상황 시뮬레이션" value={generated.simulations} />
      <GeneratedSection title="평가 루브릭" value={generated.rubric} />
      <GeneratedSection title="최종 리포트" value={generated.finalReportTemplate} />
    </div>
  );
}
