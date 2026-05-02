import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { HandoverJob } from "@/lib/types";

function buildDummyHandover(job: HandoverJob) {
  const title = `${job.organization_name} ${job.job_title} 인수인계 프로젝트`;
  const mainTasks = job.main_tasks || "주요 업무를 확인하고 우선순위에 따라 처리합니다.";
  const commonSituations = job.common_situations || "예상하지 못한 문의나 일정 변경 상황이 발생합니다.";

  return {
    jobUnderstanding: {
      title,
      organizationName: job.organization_name,
      jobTitle: job.job_title,
      industry: job.industry,
      traineeLevel: job.trainee_level,
      summary: `${job.organization_name}의 ${job.job_title} 역할은 ${mainTasks}를 안정적으로 수행하는 것이 핵심입니다.`,
      context: job.organization_context,
    },
    workflow: [
      {
        step: 1,
        title: "업무 시작 전 확인",
        description: job.daily_workflow || "오늘 처리할 업무와 전달사항을 먼저 확인합니다.",
      },
      {
        step: 2,
        title: "주요 업무 처리",
        description: mainTasks,
      },
      {
        step: 3,
        title: "기록과 공유",
        description: job.handover_rules || "처리한 내용을 기록하고 관련자에게 공유합니다.",
      },
    ],
    handoverManual: [
      {
        title: "반드시 지킬 규칙",
        body: job.handover_rules || "중요한 결정은 담당자 확인 후 진행합니다.",
      },
      {
        title: "피해야 할 행동",
        body: job.do_not_do || "확인되지 않은 내용을 단정해서 안내하지 않습니다.",
      },
      {
        title: "자주 하는 실수",
        body: job.common_mistakes || "처리 내용을 기록하지 않아 다음 담당자가 상황을 모르는 일이 생깁니다.",
      },
    ],
    checklists: [
      { label: "오늘 처리할 주요 업무를 확인했다.", required: true },
      { label: "중요 업무의 확인 절차를 지켰다.", required: true },
      { label: "처리 결과를 문서나 시스템에 기록했다.", required: true },
      { label: `${job.job_title} 업무의 최종 목표를 설명할 수 있다.`, required: false },
    ],
    trainingProjects: [
      {
        title: `${job.job_title} 첫 실무 처리 프로젝트`,
        situation: commonSituations,
        goal: job.final_goal || `${job.training_days ?? 5}일 안에 기본 업무를 혼자 처리할 수 있습니다.`,
        tasks: [
          "상황을 읽고 필요한 확인 사항을 정리합니다.",
          "관련자에게 어떤 순서로 확인할지 작성합니다.",
          "처리 결과를 남길 기록 문장을 작성합니다.",
        ],
        deliverables: ["처리 순서", "확인 질문 목록", "최종 안내 문장"],
        evaluationCriteria: [
          job.success_criteria || "누락 없이 확인하고 관련자에게 정확히 공유합니다.",
          "절대 하면 안 되는 행동을 피했습니다.",
          "기록이 다음 담당자도 이해할 수 있을 만큼 명확합니다.",
        ],
      },
    ],
    simulations: [
      {
        title: "자주 발생하는 곤란한 상황 대응",
        scenario: commonSituations,
        expectedActions: [
          "상대의 요청과 불만을 먼저 정리합니다.",
          "즉시 확정해도 되는 일과 확인이 필요한 일을 구분합니다.",
          "처리 후 기록과 공유를 완료합니다.",
        ],
      },
    ],
    rubric: {
      criteria: [
        {
          name: "업무 맥락 이해",
          excellent: `${job.organization_name}의 환경과 ${job.job_title}의 중요도를 연결해 설명합니다.`,
          good: "주요 업무와 기본 흐름을 설명합니다.",
          needsImprovement: "업무 목적과 이해관계자를 추가로 학습해야 합니다.",
        },
        {
          name: "실무 처리 안정성",
          excellent: "핵심 규칙을 지키며 기록과 공유까지 완료합니다.",
          good: "대부분의 업무를 순서대로 처리합니다.",
          needsImprovement: "확인 절차나 기록이 누락됩니다.",
        },
      ],
    },
    finalReportTemplate: {
      title: `${job.job_title} 교육 완료 리포트`,
      sections: ["수행한 업무", "잘한 점", "보완할 점", "추가 교육 필요 사항", "독립 수행 가능 여부"],
    },
  };
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { jobId } = (await request.json()) as { jobId?: string };

  if (!jobId) {
    return NextResponse.json({ error: "jobId가 필요합니다." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "사용자 정보를 확인할 수 없습니다." }, { status: 401 });
  }

  const { data: job, error: jobError } = await supabase
    .from("handover_jobs")
    .select("*")
    .eq("id", jobId)
    .single<HandoverJob>();

  if (jobError || !job) {
    return NextResponse.json(
      {
        error:
          "인수인계 직무를 찾을 수 없습니다. 로그인 사용자와 owner_id가 일치하는지, handover_jobs select RLS 정책을 확인해주세요.",
      },
      { status: 404 },
    );
  }

  const generatedJson = buildDummyHandover(job);
  const { data: project, error: insertError } = await supabase
    .from("handover_projects")
    .insert({
      job_id: job.id,
      owner_id: user.id,
      title: generatedJson.jobUnderstanding.title,
      summary: generatedJson.jobUnderstanding.summary,
      generated_json: generatedJson,
      status: "generated",
    })
    .select("id")
    .single();

  if (insertError || !project) {
    return NextResponse.json(
      {
        error: `프로젝트 저장에 실패했습니다. handover_projects insert RLS 정책과 owner_id를 확인해주세요. 상세: ${
          insertError?.message ?? "저장 결과가 비어 있습니다."
        }`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ projectId: project.id });
}
