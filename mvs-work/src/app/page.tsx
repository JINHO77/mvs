import Link from "next/link";

export default function HomePage() {
  return (
    <section className="grid gap-8 rounded-lg border border-line bg-white p-8 md:grid-cols-[1.2fr_0.8fr]">
      <div>
        <p className="mb-3 text-sm font-medium text-mint">AI 인수인계 프로젝트 생성기 MVP</p>
        <h1 className="text-3xl font-bold leading-tight text-ink md:text-5xl">
          업무를 모르는 사람도 따라올 수 있게, 인수인계를 프로젝트로 만듭니다.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
          업체 정보, 실제 업무 흐름, 자주 생기는 문제, 교육 목표를 입력하면 업무 파악 자료와
          체크리스트, 훈련 프로젝트, 상황 시뮬레이션까지 한 번에 확인할 수 있습니다.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/jobs/new" className="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white">
            새 인수인계 만들기
          </Link>
          <Link href="/dashboard" className="rounded-md border border-line px-5 py-3 text-sm font-semibold text-ink">
            대시보드 보기
          </Link>
        </div>
      </div>
      <div className="rounded-lg bg-paper p-6">
        <h2 className="text-lg font-semibold text-ink">MVP 흐름</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-muted">
          <li>1. 업무 담당자가 쉬운 질문에 답합니다.</li>
          <li>2. 입력한 내용을 Supabase에 저장합니다.</li>
          <li>3. 더미 AI 생성기로 인수인계 프로젝트를 만듭니다.</li>
          <li>4. 결과를 확인하고 첫 훈련 프로젝트를 실행합니다.</li>
        </ol>
      </div>
    </section>
  );
}
