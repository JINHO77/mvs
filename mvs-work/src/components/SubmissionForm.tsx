"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function getSubmissionErrorMessage(message?: string) {
  const detail = message ? ` 상세: ${message}` : "";
  return `제출 저장에 실패했습니다. 로그인 상태, handover_submissions 테이블, RLS owner_id 정책을 확인해주세요.${detail}`;
}

export default function SubmissionForm({ projectId }: { projectId: string }) {
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("로그인 후 제출할 수 있습니다.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("handover_submissions").insert({
      project_id: projectId,
      owner_id: user.id,
      answer,
      status: "submitted",
    });

    setLoading(false);

    if (error) {
      setMessage(getSubmissionErrorMessage(error.message));
      return;
    }

    setAnswer("");
    setMessage("제출이 저장되었습니다.");
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-line bg-white p-6">
      <h2 className="text-xl font-semibold text-ink">답변 입력</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        작성한 답변은 `handover_submissions`에 로그인한 사용자 ID와 함께 저장됩니다.
      </p>
      <textarea
        className="mt-5 min-h-72 w-full resize-y rounded-md border border-line px-3 py-2 text-sm leading-6"
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="예: 먼저 상황을 정리하고, 확인해야 할 사람과 순서를 적은 뒤, 최종 안내 문장을 작성합니다."
        required
        value={answer}
      />
      {message ? <p className="mt-3 rounded-md bg-paper p-3 text-sm text-muted">{message}</p> : null}
      <button
        className="mt-4 rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        disabled={loading}
        type="submit"
      >
        {loading ? "제출 중..." : "제출하기"}
      </button>
    </form>
  );
}
