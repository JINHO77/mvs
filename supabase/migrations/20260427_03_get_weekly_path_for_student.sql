-- get_weekly_path_for_student를 effective_grade 기반으로 갱신
-- (upsert_student_weekly_path는 이미 이 함수를 호출하므로 자동 적용됨)

CREATE OR REPLACE FUNCTION public.get_weekly_path_for_student(
  p_student_id uuid,
  p_subject text,
  p_week_key integer
)
RETURNS TABLE(path_key text, unit_id uuid, unit_name text, rotation_week integer)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_school_level    text;
  v_profile_grade   integer;
  v_curr_grade      integer;
  v_lookup_level    text;
  v_total_units     integer;
  v_rotation_index  integer;
  v_unit_id         uuid;
  v_unit_name       text;
  v_week_num        integer;
  v_path_key        text;
  v_eff_school      text;
  v_eff_grade       integer;
  v_is_preview      boolean;
BEGIN
  SELECT p.school_level, p.grade
  INTO v_school_level, v_profile_grade
  FROM profiles p
  WHERE p.id = p_student_id;

  IF v_school_level IS NULL THEN RETURN; END IF;

  -- 1~2월 예습 모드 적용
  SELECT effective_school_level, effective_grade, is_preview
  INTO v_eff_school, v_eff_grade, v_is_preview
  FROM get_effective_grade(v_school_level, v_profile_grade);

  v_lookup_level := CASE LOWER(v_eff_school)
    WHEN 'middle' THEN 'middle'
    WHEN 'elementary' THEN 'elementary'
    WHEN 'high' THEN 'high'
    ELSE 'middle'
  END;
  v_curr_grade := COALESCE(v_eff_grade, 1);

  SELECT COUNT(*) INTO v_total_units
  FROM unit_weekly_rotation uwr
  WHERE uwr.subject = p_subject
    AND uwr.school_level = v_lookup_level
    AND uwr.grade = v_curr_grade
    AND uwr.is_active = true;

  IF v_total_units = 0 THEN
    SELECT uwr.grade INTO v_curr_grade
    FROM unit_weekly_rotation uwr
    WHERE uwr.subject = p_subject
      AND uwr.school_level = v_lookup_level
      AND uwr.is_active = true
    ORDER BY ABS(uwr.grade - v_curr_grade)
    LIMIT 1;

    IF v_curr_grade IS NULL THEN
      IF v_lookup_level = 'high' THEN
        v_lookup_level := 'middle';
        v_curr_grade := 3;
      ELSE
        v_lookup_level := 'elementary';
        v_curr_grade := 4;
      END IF;
    END IF;

    SELECT COUNT(*) INTO v_total_units
    FROM unit_weekly_rotation uwr
    WHERE uwr.subject = p_subject
      AND uwr.school_level = v_lookup_level
      AND uwr.grade = v_curr_grade
      AND uwr.is_active = true;
  END IF;

  IF v_total_units = 0 THEN RETURN; END IF;

  v_week_num := p_week_key % 100;
  v_rotation_index := ((v_week_num - 1) % v_total_units) + 1;

  SELECT uwr.unit_id, cu.unit_name
  INTO v_unit_id, v_unit_name
  FROM unit_weekly_rotation uwr
  JOIN curriculum_units cu ON cu.id = uwr.unit_id
  WHERE uwr.subject = p_subject
    AND uwr.school_level = v_lookup_level
    AND uwr.grade = v_curr_grade
    AND uwr.rotation_order = v_rotation_index
    AND uwr.is_active = true
  LIMIT 1;

  IF v_unit_id IS NULL THEN RETURN; END IF;

  WITH path_pool AS (
    SELECT
      lpr.path_key,
      MAX(lpr.created_at) AS path_created_at
    FROM learning_path_recommendations lpr
    WHERE lpr.unit_id = v_unit_id
      AND lpr.subject = p_subject
      AND lpr.is_active = true
    GROUP BY lpr.path_key
  ),
  student_history AS (
    SELECT DISTINCT swp.path_key
    FROM student_weekly_paths swp
    WHERE swp.student_id = p_student_id
      AND swp.subject = p_subject
      AND swp.week_key <> p_week_key
  )
  SELECT pp.path_key INTO v_path_key
  FROM path_pool pp
  WHERE pp.path_key NOT IN (SELECT sh.path_key FROM student_history sh)
  ORDER BY pp.path_created_at DESC, pp.path_key ASC
  LIMIT 1;

  IF v_path_key IS NULL THEN
    WITH path_pool AS (
      SELECT
        lpr.path_key,
        MAX(lpr.created_at) AS path_created_at
      FROM learning_path_recommendations lpr
      WHERE lpr.unit_id = v_unit_id
        AND lpr.subject = p_subject
        AND lpr.is_active = true
      GROUP BY lpr.path_key
    ),
    last_seen AS (
      SELECT swp.path_key, MAX(swp.week_key) AS last_week
      FROM student_weekly_paths swp
      WHERE swp.student_id = p_student_id
        AND swp.subject = p_subject
        AND swp.week_key <> p_week_key
      GROUP BY swp.path_key
    )
    SELECT pp.path_key INTO v_path_key
    FROM path_pool pp
    LEFT JOIN last_seen ls ON ls.path_key = pp.path_key
    ORDER BY ls.last_week ASC NULLS FIRST, pp.path_created_at DESC
    LIMIT 1;
  END IF;

  IF v_path_key IS NULL THEN RETURN; END IF;

  RETURN QUERY SELECT v_path_key, v_unit_id, v_unit_name, v_rotation_index;
END;
$function$;
