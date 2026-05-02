"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getProjectErrorMessage(message?: string) {
  return message
    ? `프로젝트 생성에 실패했습니다. ${message}`
    : "프로젝트 생성에 실패했습니다. 로그인 상태와 handover_projects RLS 정책을 확인해주세요.";
}

export default function GenerateProjectButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError("로그인 후 프로젝트를 생성할 수 있습니다.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/generate-handover", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ jobId }),
    });

    const result = (await response.json()) as { projectId?: string; error?: string };

    if (!response.ok || !result.projectId) {
      setError(getProjectErrorMessage(result.error));
      setLoading(false);
      return;
    }

    router.push(`/projects/${result.projectId}`);
    router.refresh();
  }

  return (
    <div>
      <button
        className="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        disabled={loading}
        onClick={handleGenerate}
        type="button"
      >
        {loading ? "생성 중..." : "AI 인수인계 프로젝트 생성"}
      </button>
      {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
