import Link from "next/link";

export default function OnboardingRequiredPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> 역할 선택 안내
        </h1>
        <p className="mt-3 text-sm text-[#B8B8C3]">역할 선택이 필요합니다.</p>
        <Link
          href="/onboarding/role"
          className="mt-5 inline-block rounded-xl bg-[#D4AF37] px-4 py-2 font-semibold text-black"
        >
          역할 선택하러 가기
        </Link>
      </div>
    </main>
  );
}
