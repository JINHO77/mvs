-- 1) metrics table name alignment
DO $$
BEGIN
  IF to_regclass('public.report_english_metrics') IS NULL
     AND to_regclass('public.english_report_metrics') IS NOT NULL THEN
    ALTER TABLE public.english_report_metrics RENAME TO report_english_metrics;
  END IF;
END $$;

-- 2) role data normalization (if any legacy text values exist)
UPDATE public.profiles
SET role = 'parent'
WHERE role::text = 'guardian';

-- 3) hardening: ensure helper view/function use parent only
CREATE OR REPLACE VIEW public.v_guardian_students AS
SELECT
  sg.guardian_id,
  sg.student_id
FROM public.student_guardians sg
JOIN public.profiles g
  ON g.id = sg.guardian_id
 AND g.role = 'parent'
JOIN public.profiles s
  ON s.id = sg.student_id
 AND s.role = 'student';

CREATE OR REPLACE FUNCTION public.get_guardian_linked_student_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.v_guardian_students vgs
  WHERE vgs.guardian_id = auth.uid();
$$;

GRANT SELECT ON public.v_guardian_students TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_guardian_linked_student_count() TO authenticated;

-- 4) storage policy role guard normalize: parent only
DROP POLICY IF EXISTS "rpt_attach_v20260304_select_by_report_access" ON storage.objects;

CREATE POLICY "rpt_attach_v20260304_select_by_report_access"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'report_attachments'
  AND EXISTS (
    SELECT 1
    FROM public.reports r
    WHERE r.math_pdf_path = storage.objects.name
      AND COALESCE(r.is_deleted, false) = false
      AND (
        EXISTS (
          SELECT 1
          FROM public.profiles me
          WHERE me.id = auth.uid()
            AND me.role = 'owner'
            AND COALESCE(me.account_status, 'active') = 'active'
            AND me.academy_id = r.academy_id
        )
        OR (
          r.student_id = auth.uid()
          AND EXISTS (
            SELECT 1
            FROM public.profiles me
            WHERE me.id = auth.uid()
              AND COALESCE(me.account_status, 'active') = 'active'
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.student_guardians sg
          JOIN public.profiles me ON me.id = auth.uid()
          WHERE sg.guardian_id = auth.uid()
            AND sg.student_id = r.student_id
            AND me.role = 'parent'
            AND COALESCE(me.account_status, 'active') = 'active'
        )
      )
  )
);
