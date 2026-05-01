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

  const subject = type === 'creative' ? 'weekend_creative' : 'weekend_character';

  const { data, error } = await supabase
    .from('generated_missions')
    .select('id, title, scenario, difficulty, estimated_minutes, mission_json, interest_tags, subject')
    .eq('subject', subject)
    .eq('status', 'published')
    .eq('is_active', true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // level=all 이면 전체 반환, 특정 레벨 지정 시에만 필터링
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = level === 'all'
    ? (data || [])
    : (data || []).filter((m: any) => {
        const mLevel = m.mission_json?.level;
        return !mLevel || mLevel === 'all' || mLevel === level;
      });

  return NextResponse.json({ missions: filtered, total: filtered.length });
}
