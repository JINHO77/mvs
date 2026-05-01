'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Consultation = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  requested_start_at: string | null;
  manual_consultation_content: string | null;
  manual_student_name: string | null;
};

const statusConfig: Record<string, {
  label: string; icon: string; color: string; message: string; messageColor: string;
}> = {
  requested: {
    label: '검토 중', icon: '⏳',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    message: '원장님이 확인 중이에요. 일정이 확정되면 알려드릴게요.',
    messageColor: 'text-amber-600 dark:text-amber-400',
  },
  confirmed: {
    label: '일정 확정', icon: '✅',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    message: '상담 일정이 확정됐어요. 예약하신 날짜에 꼭 참석해 주세요.',
    messageColor: 'text-green-600 dark:text-green-400',
  },
  canceled: {
    label: '취소됨', icon: '✕',
    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    message: '상담이 취소됐어요.',
    messageColor: 'text-gray-500 dark:text-gray-400',
  },
  cancelled: {
    label: '취소됨', icon: '✕',
    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    message: '상담이 취소됐어요.',
    messageColor: 'text-gray-500 dark:text-gray-400',
  },
  done: {
    label: '상담 완료', icon: '🎉',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    message: '상담이 완료됐어요. 이용해 주셔서 감사합니다.',
    messageColor: 'text-blue-600 dark:text-blue-400',
  },
  no_show: {
    label: '미참석', icon: '⚠️',
    color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    message: '예약 시간에 참석하지 않으셨어요.',
    messageColor: 'text-red-500 dark:text-red-400',
  },
  rescheduled: {
    label: '일정변경', icon: '🔄',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    message: '상담 일정이 변경됐어요. 새 일정을 확인해 주세요.',
    messageColor: 'text-amber-600 dark:text-amber-400',
  },
};

const TAB_FILTERS = [
  { key: 'all',      label: '전체' },
  { key: 'active',   label: '진행 중' },
  { key: 'done',     label: '완료' },
  { key: 'canceled', label: '취소·미참석' },
];

export default function ConsultationHistoryPage() {
  const router = useRouter();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data } = await supabase
        .from('consultation_requests')
        .select('id, type, status, created_at, requested_start_at, manual_consultation_content, manual_student_name')
        .eq('guardian_id', user.id)
        .order('created_at', { ascending: false });

      setConsultations(data ?? []);
      setLoading(false);
    };
    void load();
  }, [router]);

  const filtered = consultations.filter(c => {
    if (activeTab === 'active')   return ['requested', 'confirmed', 'rescheduled'].includes(c.status);
    if (activeTab === 'done')     return c.status === 'done';
    if (activeTab === 'canceled') return ['canceled', 'cancelled', 'no_show'].includes(c.status);
    return true;
  });

  const typeLabel = (t: string) =>
    t === 'phone' ? '📞 전화 상담' : t === 'in_person' ? '🏫 대면 상담' : '💻 화상 상담';

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => router.push('/parent')}
            className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            ← 대시보드
          </button>
          <h1 className="text-base font-bold">전체 상담 내역</h1>
          <button
            type="button"
            onClick={() => router.push('/consult/request')}
            className="flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[#0b1220] transition-opacity hover:opacity-90"
          >
            + 새 신청
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* 탭 필터 */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {TAB_FILTERS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-[var(--accent)] text-[#0b1220]'
                  : 'border border-[var(--border)] bg-[var(--card)] text-[var(--text-muted)] hover:border-[var(--accent)]'
              }`}
            >
              {tab.label}
              {tab.key === 'all' && (
                <span className="ml-1.5 text-xs opacity-70">{consultations.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-muted)]">
            <span className="text-4xl">📋</span>
            <p className="text-sm">해당 상담 내역이 없어요</p>
            {activeTab !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="text-xs underline"
              >
                전체 보기
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(c => {
              const st = statusConfig[c.status] ?? {
                label: c.status, icon: '📋',
                color: 'bg-gray-100 text-gray-500',
                message: '', messageColor: 'text-gray-400',
              };
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
                >
                  {/* 상단: 상태 + 유형 + 날짜 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${st.color}`}>
                        {st.icon} {st.label}
                      </span>
                      <span className="text-sm font-medium">{typeLabel(c.type)}</span>
                    </div>
                    <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                      {new Date(c.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                    </span>
                  </div>

                  {/* 안내 문구 */}
                  {st.message && (
                    <p className={`flex items-start gap-1.5 text-xs ${st.messageColor}`}>
                      <span className="mt-0.5 flex-shrink-0">💬</span>
                      {st.message}
                    </p>
                  )}

                  {/* 상담 내용 */}
                  {c.manual_consultation_content && (
                    <p className="line-clamp-2 border-l-2 border-[var(--border)] pl-1 text-sm text-[var(--text-muted)]">
                      {c.manual_consultation_content}
                    </p>
                  )}

                  {/* 희망일 */}
                  {c.requested_start_at && (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <span>📅</span>
                      <span>
                        희망일: {new Date(c.requested_start_at).toLocaleDateString('ko-KR', {
                          month: 'long', day: 'numeric', weekday: 'short',
                        })}
                      </span>
                      {c.status === 'confirmed' && (
                        <span className="font-medium text-green-500">(확정)</span>
                      )}
                    </div>
                  )}

                  {/* confirmed 강조 박스 */}
                  {c.status === 'confirmed' && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                      ✅ 상담이 확정됐어요! 예약 날짜를 꼭 확인해 주세요.
                    </div>
                  )}

                  {/* 재신청 유도 */}
                  {(c.status === 'canceled' || c.status === 'cancelled' || c.status === 'no_show') && (
                    <button
                      type="button"
                      onClick={() => router.push('/consult/request')}
                      className="text-left text-xs text-[var(--text-muted)] underline transition-colors hover:text-[var(--accent)]"
                    >
                      다시 신청하기 →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 하단 새 상담 신청 버튼 */}
        <div className="mt-8 pb-8">
          <button
            type="button"
            onClick={() => router.push('/consult/request')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] py-3.5 text-sm font-bold text-[#0b1220] shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <span className="text-base">+</span>
            새 상담 신청하기
          </button>
        </div>
      </main>
    </div>
  );
}
