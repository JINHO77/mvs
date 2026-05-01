-- Fix at_select policy: school_level/grade/class 타입 타겟도 해당 학생에게 보이도록
-- 기존 정책은 'all'과 'student' 타입만 허용해서 그룹 타겟팅 알리미의 상세 페이지가 막혔음.
-- announcements_select 정책의 내부 서브쿼리와 동일한 로직으로 맞춤.

DROP POLICY IF EXISTS at_select ON public.announcement_targets;

CREATE POLICY at_select
ON public.announcement_targets
FOR SELECT
USING (
  is_staff()
  OR target_type = 'all'
  OR (target_type = 'student' AND student_id = (SELECT auth.uid()))
  OR (
    target_type IN ('school_level', 'grade', 'class')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (target_type <> 'school_level' OR p.school_level = announcement_targets.school_level)
        AND (target_type <> 'grade' OR (p.school_level = announcement_targets.school_level AND p.grade = announcement_targets.grade))
        AND (target_type <> 'class' OR (p.school_level = announcement_targets.school_level AND p.grade = announcement_targets.grade AND p.class_label = announcement_targets.class_label))
    )
  )
);
