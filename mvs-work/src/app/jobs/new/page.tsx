import { redirect } from "next/navigation";
import JobForm from "@/components/JobForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewJobPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">새 인수인계 만들기</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          직무명을 짧게 쓰는 것보다, 처음 온 사람에게 차근차근 설명하듯 적을수록 좋은 프로젝트가
          만들어집니다.
        </p>
      </div>
      <JobForm />
    </div>
  );
}
