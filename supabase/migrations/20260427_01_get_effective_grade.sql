CREATE OR REPLACE FUNCTION public.get_effective_grade(
  p_school_level text,
  p_grade integer,
  p_at timestamp with time zone DEFAULT now()
)
RETURNS TABLE(effective_school_level text, effective_grade integer, is_preview boolean)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  v_month integer;
  v_school text := p_school_level;
  v_grade integer := p_grade;
  v_preview boolean := false;
BEGIN
  v_month := EXTRACT(MONTH FROM (p_at AT TIME ZONE 'Asia/Seoul'))::int;

  IF v_month IN (1, 2) AND p_school_level IS NOT NULL AND p_grade IS NOT NULL THEN
    v_preview := true;

    IF p_school_level = 'elementary' AND p_grade < 6 THEN
      v_grade := p_grade + 1;
    ELSIF p_school_level = 'elementary' AND p_grade = 6 THEN
      v_school := 'middle';
      v_grade := 1;
    ELSIF p_school_level = 'middle' AND p_grade < 3 THEN
      v_grade := p_grade + 1;
    ELSIF p_school_level = 'middle' AND p_grade = 3 THEN
      v_school := 'high';
      v_grade := 1;
    ELSIF p_school_level = 'high' AND p_grade < 3 THEN
      v_grade := p_grade + 1;
    ELSE
      v_preview := false;
    END IF;
  END IF;

  RETURN QUERY SELECT v_school, v_grade, v_preview;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_effective_grade(text, integer, timestamptz) TO authenticated, anon;
