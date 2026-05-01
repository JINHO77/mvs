CREATE OR REPLACE VIEW public.v_student_effective_grade AS
SELECT
  p.id AS student_id,
  p.name,
  p.school_level,
  p.grade,
  CASE p.school_level
    WHEN 'elementary' THEN '초'
    WHEN 'middle' THEN '중'
    WHEN 'high' THEN '고'
  END || COALESCE(p.grade::text, '?') AS grade_label,
  eg.effective_school_level,
  eg.effective_grade,
  CASE eg.effective_school_level
    WHEN 'elementary' THEN '초'
    WHEN 'middle' THEN '중'
    WHEN 'high' THEN '고'
  END || eg.effective_grade::text AS effective_grade_label,
  eg.is_preview,
  CASE
    WHEN eg.is_preview THEN
      '예습 모드: ' || (CASE eg.effective_school_level
        WHEN 'elementary' THEN '초'
        WHEN 'middle' THEN '중'
        WHEN 'high' THEN '고'
      END) || eg.effective_grade::text || ' 콘텐츠를 미리 학습 중'
    ELSE NULL
  END AS preview_message
FROM profiles p,
LATERAL get_effective_grade(p.school_level, p.grade) eg
WHERE p.role = 'student';

GRANT SELECT ON public.v_student_effective_grade TO authenticated;
