import HomeLink from "@/components/common/HomeLink";

export default function OnboardingPendingPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] p-6 text-[var(--text)]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <div className="mb-3 flex justify-end">
          <HomeLink />
        </div>
        <h1 className="text-2xl font-semibold">
          <span className="text-[var(--accent)]">MVS</span> 가입 승인 대기
        </h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          가입 승인 대기 중입니다. 학원 관리자 승인 후 이용할 수 있어요.
        </p>
      </div>
    </main>
  );
}
