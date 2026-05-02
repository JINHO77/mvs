import { redirect } from "next/navigation";
import GeneratedSection from "@/components/GeneratedSection";
import SubmissionForm from "@/components/SubmissionForm";
import { createClient } from "@/lib/supabase/server";
import type { HandoverProject } from "@/lib/types";

export default async function ProjectRunPage({ params }: { params: Promise<{ id: string }> }) {
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
        훈련 프로젝트를 불러오지 못했습니다. 로그인 사용자와 owner_id가 일치하는지,
        handover_projects select RLS 정책을 확인해주세요. 상세: {error.message}
      </div>
    );
  }

  if (!project) redirect("/jobs");

  const trainingProject = project.generated_json?.trainingProjects?.[0] ?? {};

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-white p-6">
        <p className="text-sm text-muted">훈련 프로젝트 실행 화면</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">
          {String(trainingProject.title ?? "첫 훈련 프로젝트")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          첫 MVP에서는 첫 번째 훈련 프로젝트를 보여주고, 제출 UI까지 제공합니다.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="space-y-4">
          <GeneratedSection title="상황" value={trainingProject.situation} />
          <GeneratedSection title="목표" value={trainingProject.goal} />
          <GeneratedSection title="수행 과제" value={trainingProject.tasks} />
          <GeneratedSection title="제출물" value={trainingProject.deliverables} />
          <GeneratedSection title="평가 기준" value={trainingProject.evaluationCriteria} />
        </section>

        <SubmissionForm projectId={project.id} />
      </div>
    </div>
  );
}
