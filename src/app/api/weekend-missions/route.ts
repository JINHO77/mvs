import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const level = searchParams.get('level') || 'all';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );

  const subject =
    type === 'creative' ? 'weekend_creative' : 'weekend_character';

  // ★ jsonb 필터 없이 전체 조회 — JS에서 level 필터링
  const { data, error } = await supabase
    .from('generated_missions')
    .select(
      'id, title, scenario, difficulty, estimated_minutes, mission_json, interest_tags, subject'
    )
    .eq('subject', subject)
    .eq('status', 'published')
    .eq('is_active', true);

  if (error) {
    console.error('weekend-missions API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ mission: null, total: 0 });
  }

  // level 필터: 해당 레벨 OR 'all' OR null(미설정) 모두 포함
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = data.filter((m: any) => {
    const mLevel = m.mission_json?.level;
    return !mLevel || mLevel === 'all' || mLevel === level;
  });

  const pool = filtered.length > 0 ? filtered : data;
  const random = pool[Math.floor(Math.random() * pool.length)];

  return NextResponse.json({ mission: random, total: pool.length });
}
