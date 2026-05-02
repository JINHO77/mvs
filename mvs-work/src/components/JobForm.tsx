"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSaveErrorMessage(message?: string) {
  const detail = message ? ` 상세: ${message}` : "";
  return `저장에 실패했습니다. 로그인 상태, handover_jobs 테이블, RLS owner_id 정책을 확인해주세요.${detail}`;
}

const fieldClass = "mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm";
const textAreaClass = `${fieldClass} min-h-28 resize-y leading-6`;

type Field = {
  name: string;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "input" | "textarea" | "select" | "number";
};

const sections: Array<{ title: string; description: string; fields: Field[] }> = [
  {
    title: "A. 업체/조직 정보",
    description: "AI가 어떤 환경의 업무인지 먼저 이해할 수 있게 적어주세요.",
    fields: [
      {
        name: "organization_name",
        label: "업체/조직명",
        placeholder: "예: 해봄 영어수학 학원",
        required: true,
      },
      {
        name: "industry",
        label: "업종",
        placeholder: "예: 교육, 병원, 제조, 온라인 쇼핑몰, 세무사무소",
      },
      {
        name: "organization_context",
        label: "조직/업무 환경 설명",
        type: "textarea",
        placeholder:
          "예: 학부모 상담, 결석/보강 관리, 수강료 안내가 자주 발생하는 초중고 영어·수학 학원입니다.",
      },
    ],
  },
  {
    title: "B. 직무 기본 정보",
    description: "후임자가 맡게 될 역할과 교육 조건을 알려주세요.",
    fields: [
      {
        name: "job_title",
        label: "인수인계할 직무명",
        placeholder: "예: 학원 운영 매니저",
        required: true,
      },
      {
        name: "department",
        label: "부서/역할",
        placeholder: "예: 운영팀 / 데스크 응대와 학부모 커뮤니케이션 담당",
      },
      {
        name: "trainee_level",
        label: "교육 대상 수준",
        type: "select",
        placeholder: "beginner",
      },
      {
        name: "training_days",
        label: "교육 기간",
        type: "number",
        placeholder: "예: 5",
      },
      {
        name: "job_importance",
        label: "이 직무가 중요한 이유",
        type: "textarea",
        placeholder: "예: 보강 일정과 수강료 안내가 꼬이면 학부모 불만과 강사 일정 충돌이 바로 발생합니다.",
      },
    ],
  },
  {
    title: "C. 실제 업무 설명",
    description: "하루가 어떻게 흘러가는지, 반복 업무가 무엇인지 구체적으로 적어주세요.",
    fields: [
      {
        name: "daily_workflow",
        label: "하루 업무 흐름",
        type: "textarea",
        placeholder: "예: 오전에는 전날 결석자를 확인하고, 오후에는 등원 체크와 상담 전화를 처리합니다.",
      },
      {
        name: "main_tasks",
        label: "반복적으로 하는 주요 업무",
        type: "textarea",
        placeholder: "예: 출결 확인, 보강 일정 조율, 신규 상담 예약, 수강료 납부 안내, 강사 전달사항 정리",
      },
      {
        name: "critical_tasks",
        label: "실수하면 큰 문제가 되는 업무",
        type: "textarea",
        placeholder: "예: 보강 일정 확정, 환불 안내, 학생 안전 관련 연락, 테스트 결과 전달",
      },
      {
        name: "required_tools",
        label: "자주 사용하는 도구/문서/시스템",
        type: "textarea",
        placeholder: "예: 학원관리 프로그램, 카카오톡 채널, 상담 기록지, 보강 일정표, 수강료 납부표",
      },
    ],
  },
  {
    title: "D. 인수인계 핵심 내용",
    description: "후임자가 꼭 지켜야 할 규칙과 피해야 할 행동을 적어주세요.",
    fields: [
      {
        name: "handover_rules",
        label: "후임자가 반드시 알아야 하는 핵심 규칙",
        type: "textarea",
        placeholder: "예: 보강 일정은 강사와 학부모 양쪽 모두 확인한 뒤 확정해야 합니다.",
      },
      {
        name: "do_not_do",
        label: "절대 하면 안 되는 행동",
        type: "textarea",
        placeholder: "예: 강사 확인 없이 보강 시간을 확정하지 않습니다. 환불 가능 여부를 즉석에서 단정하지 않습니다.",
      },
      {
        name: "common_mistakes",
        label: "신입자가 자주 하는 실수",
        type: "textarea",
        placeholder: "예: 학부모에게 전달한 내용을 상담 기록지에 남기지 않거나, 결석 사유를 강사에게 늦게 공유합니다.",
      },
    ],
  },
  {
    title: "E. 문제 상황과 교육 목표",
    description: "훈련 프로젝트와 상황 시뮬레이션을 만들기 위한 재료입니다.",
    fields: [
      {
        name: "common_situations",
        label: "자주 발생하는 곤란한 상황",
        type: "textarea",
        placeholder: "예: 학부모가 보강 시간을 계속 바꾸거나, 수강료 안내를 받지 못했다고 항의하는 상황",
      },
      {
        name: "success_criteria",
        label: "일을 잘한다는 기준",
        type: "textarea",
        placeholder: "예: 문의를 놓치지 않고 기록하며, 일정 변경 시 관련자에게 같은 내용을 정확히 공유합니다.",
      },
      {
        name: "final_goal",
        label: "교육 후 최종적으로 할 수 있어야 하는 일",
        type: "textarea",
        placeholder: "예: 5일 후에는 학부모 문의와 보강 일정 조율을 혼자 처리하고 기록까지 완료할 수 있어야 합니다.",
      },
    ],
  },
];

export default function JobForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("로그인 후 인수인계 정보를 저장할 수 있습니다.");
      setLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const trainingDays = Number(payload.training_days || 5);

    const { data, error: insertError } = await supabase
      .from("handover_jobs")
      .insert({
        ...payload,
        owner_id: user.id,
        training_days: Number.isFinite(trainingDays) ? trainingDays : 5,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError || !data) {
      setError(getSaveErrorMessage(insertError?.message));
      setLoading(false);
      return;
    }

    router.push(`/jobs/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {sections.map((section) => (
        <section key={section.title} className="rounded-lg border border-line bg-white p-6">
          <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
          <p className="mt-2 text-sm text-muted">{section.description}</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {section.fields.map((field) => (
              <label
                key={field.name}
                className={field.type === "textarea" ? "block md:col-span-2" : "block"}
              >
                <span className="text-sm font-medium text-ink">
                  {field.label}
                  {field.required ? <span className="text-brand"> *</span> : null}
                </span>
                {field.type === "textarea" ? (
                  <textarea
                    className={textAreaClass}
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                ) : field.type === "select" ? (
                  <select className={fieldClass} name={field.name} defaultValue="beginner">
                    <option value="beginner">초보자</option>
                    <option value="some_experience">비슷한 일을 조금 해본 사람</option>
                    <option value="experienced">업무 경험은 있지만 이 조직은 처음인 사람</option>
                  </select>
                ) : (
                  <input
                    className={fieldClass}
                    min={field.type === "number" ? 1 : undefined}
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                    type={field.type === "number" ? "number" : "text"}
                    defaultValue={field.name === "training_days" ? 5 : undefined}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end">
        <button
          className="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? "저장 중..." : "저장하고 상세 보기"}
        </button>
      </div>
    </form>
  );
}
