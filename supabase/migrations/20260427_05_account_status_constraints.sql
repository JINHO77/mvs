-- account_status에 archived, graduated 허용
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status = ANY(ARRAY[
    'pending'::text,
    'active'::text,
    'blocked'::text,
    'withdrawn'::text,
    'archived'::text,
    'graduated'::text
  ]));

-- grade는 학교급 내 학년 (1~6)만 허용
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_grade_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_grade_check
  CHECK (grade IS NULL OR grade BETWEEN 1 AND 6);
