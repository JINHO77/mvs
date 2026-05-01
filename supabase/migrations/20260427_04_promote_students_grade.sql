CREATE OR REPLACE FUNCTION public.promote_students_grade()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today_kst date;
  v_promoted_count int := 0;
  v_graduated_count int := 0;
BEGIN
  v_today_kst := (now() AT TIME ZONE 'Asia/Seoul')::date;

  IF EXTRACT(MONTH FROM v_today_kst) <> 3 OR EXTRACT(DAY FROM v_today_kst) <> 1 THEN
    RETURN json_build_object(
      'skipped', true,
      'today_kst', v_today_kst,
      'reason', 'Not March 1'
    );
  END IF;

  -- 학교급 내 진급
  WITH within_school AS (
    UPDATE profiles
    SET grade = grade + 1, updated_at = now()
    WHERE role = 'student'
      AND account_status = 'active'
      AND (
        (school_level = 'elementary' AND grade BETWEEN 1 AND 5)
        OR (school_level = 'middle' AND grade BETWEEN 1 AND 2)
        OR (school_level = 'high' AND grade BETWEEN 1 AND 2)
      )
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_promoted_count FROM within_school;

  -- 학교급 경계
  WITH cross_school AS (
    UPDATE profiles
    SET school_level = CASE
      WHEN school_level = 'elementary' AND grade = 6 THEN 'middle'
      WHEN school_level = 'middle' AND grade = 3 THEN 'high'
      ELSE school_level END,
        grade = 1,
        updated_at = now()
    WHERE role = 'student'
      AND account_status = 'active'
      AND ((school_level = 'elementary' AND grade = 6)
        OR (school_level = 'middle' AND grade = 3))
    RETURNING 1
  )
  SELECT v_promoted_count + COUNT(*)::int INTO v_promoted_count FROM cross_school;

  -- 고3 → 졸업
  WITH graduated AS (
    UPDATE profiles
    SET account_status = 'graduated', updated_at = now()
    WHERE role = 'student'
      AND account_status = 'active'
      AND school_level = 'high' AND grade = 3
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_graduated_count FROM graduated;

  RETURN json_build_object(
    'executed', true,
    'today_kst', v_today_kst,
    'promoted_count', v_promoted_count,
    'graduated_count', v_graduated_count
  );
END;
$function$;

-- pg_cron 매일 KST 00:30 실행 (3월 1일에만 진급)
DO $$ BEGIN
  PERFORM cron.unschedule('student-grade-promotion-daily-check');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'student-grade-promotion-daily-check',
  '30 15 * * *',  -- UTC 15:30 = KST 00:30
  $cmd$ SELECT public.promote_students_grade(); $cmd$
);
