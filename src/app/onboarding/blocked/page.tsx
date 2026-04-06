import HomeLink from "@/components/common/HomeLink";

export default function OnboardingBlockedPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] p-6 text-[var(--text)]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
        <div className="mb-3 flex justify-end">
          <HomeLink />
        </div>
        <h1 className="text-2xl font-semibold">
          <span className="text-[var(--accent)]">MVS</span> 계정 비활성화
        </h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          계정이 비활성화되었습니다. 학원에 문의해주세요.
        </p>
      </div>
    </main>
  );
}
