begin;

-- badges 테이블에 character badge 컬럼 추가
alter table public.badges
  add column if not exists badge_type      text not null default 'achievement',
  add column if not exists rarity          text not null default 'common',
  add column if not exists badge_color     text,
  add column if not exists character_name  text,
  add column if not exists character_story text;

-- 기존 배지 rarity 업데이트
update public.badges set rarity = 'common'   where badge_key in ('first_mission_complete','math_first_step','english_first_step');
update public.badges set rarity = 'uncommon' where badge_key in ('three_correct_streak','geometry_starter','reader_starter','speaker_starter');
update public.badges set rarity = 'rare'     where badge_key in ('five_correct_streak','explorer_three_units','graph_explorer','logic_builder','streak_reader');
update public.badges set rarity = 'epic'     where badge_key in ('hard_challenger');

-- 캐릭터 배지 삽입
insert into public.badges (
  badge_key, title, description, category, icon_url,
  subject_scope, condition_type, condition_value, is_active,
  badge_type, rarity, badge_color, character_name, character_story
) values
  (
    'char_bunny', '하얀 토끼', '첫 번째 미션을 완료하면 귀여운 하얀 토끼를 만날 수 있어요.',
    'starter', '/badges/char_bunny.svg',
    'common', 'mission_complete_count', 1, true,
    'character', 'common', '#FFB7C5', '하얀 토끼', '항상 당신 옆에서 응원하는 첫 번째 친구예요. 첫 발걸음을 함께 축하해요!'
  ),
  (
    'char_panda', '판다', '미션 5개를 완료하면 사랑스러운 판다가 나타나요.',
    'starter', '/badges/char_panda.svg',
    'common', 'mission_complete_count', 5, true,
    'character', 'uncommon', '#6B7280', '판다', '대나무를 먹으며 느긋하게 공부하는 판다예요. 꾸준함이 최고라는 걸 알고 있답니다.'
  ),
  (
    'char_fox', '수학 여우', '수학 미션 10개를 완료하면 영리한 여우를 얻어요.',
    'exploration', '/badges/char_fox.svg',
    'math', 'mission_complete_count', 10, true,
    'character', 'uncommon', '#F97316', '수학 여우', '수학을 사랑하는 영리한 여우예요. Σ 기호가 자랑이랍니다!'
  ),
  (
    'char_owl', '영어 올빼미', '영어 미션 10개를 완료하면 학식 높은 올빼미를 얻어요.',
    'reading', '/badges/char_owl.svg',
    'english', 'mission_complete_count', 10, true,
    'character', 'uncommon', '#5B9BD5', '영어 올빼미', '졸업 모자를 쓰고 영어책을 읽는 올빼미예요. 지식이 풍부하답니다!'
  ),
  (
    'char_cat', '불꽃 고양이', '5연속 정답을 기록하면 에너지 넘치는 고양이가 나타나요.',
    'streak', '/badges/char_cat.svg',
    'common', 'correct_step_streak', 5, true,
    'character', 'rare', '#FF7043', '불꽃 고양이', '불꽃처럼 연속 정답을 기록하는 고양이예요. 털 끝에서 스파크가 튀어요!'
  ),
  (
    'char_bear', '탐험 곰', '서로 다른 단원 5개를 탐험하면 모험가 곰이 합류해요.',
    'exploration', '/badges/char_bear.svg',
    'common', 'distinct_unit_complete_count', 5, true,
    'character', 'rare', '#9C59D1', '탐험 곰', '탐험가 모자를 쓰고 나침반을 들고 새로운 단원을 탐험하는 곰이에요!'
  ),
  (
    'char_dragon', '전설의 드래곤', 'hard/challenge 미션 5개를 완료하면 전설의 드래곤이 깨어나요.',
    'challenge', '/badges/char_dragon.svg',
    'common', 'difficulty_complete_count', 5, true,
    'character', 'epic', '#FFD700', '전설의 드래곤', '가장 어려운 도전을 이겨낸 자만이 만날 수 있는 전설의 드래곤이에요. 금빛 뿔이 빛나요!'
  )
on conflict (badge_key) do update set
  badge_type      = excluded.badge_type,
  rarity          = excluded.rarity,
  badge_color     = excluded.badge_color,
  character_name  = excluded.character_name,
  character_story = excluded.character_story,
  icon_url        = excluded.icon_url,
  updated_at      = now();

-- RLS: student_badges insert 정책 확인 (기존 정책이 없으면 추가)
drop policy if exists "student_badges_own_insert_v2" on public.student_badges;
create policy "student_badges_own_insert_v2"
on public.student_badges for insert
to authenticated
with check (auth.uid() = student_id);

commit;
