-- supabase/queries/check_link_code_functions.sql
-- Phase A: 학생-학부모 연결 코드 시스템 진단 (READ-ONLY)
--
-- 사용법:
--   1) Supabase 대시보드 → SQL Editor → 새 쿼리에 이 파일 전체 붙여넣기
--   2) Run → 결과를 위에서 아래로 모두 채팅에 복사 붙여넣기
--   3) 함수 본문(definition 컬럼)이 잘릴 수 있으니 셀을 클릭해 전체 텍스트 복사
--
-- 안전성:
--   - SELECT만 사용. CREATE/ALTER/DROP/INSERT/UPDATE/DELETE 없음.
--   - pg_proc / information_schema / pg_constraint / pg_indexes / pg_policies / pg_trigger 만 조회.

-- =====================================================================
-- 0. 메타: 학생/보호자/연결코드 관련 함수 전체 이름 (오타·이명 캐치용)
-- =====================================================================

SELECT '======== 0. 관련 함수 전체 목록 (네이밍 확인) ========' AS section_header;

SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS args,
  prosecdef AS security_definer
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND (
    proname ILIKE '%guardian%'
    OR proname ILIKE '%link_code%'
    OR proname ILIKE '%invitation%'
    OR proname ILIKE '%student%link%'
  )
ORDER BY proname;

-- =====================================================================
-- 1. 함수 본문 (5개) — 권한 체크/부수 효과 모두 본문에서 파악
-- =====================================================================

SELECT '======== 1/5 함수: issue_student_link_code ========' AS section_header;
SELECT
  proname AS name,
  pg_get_function_arguments(oid) AS args,
  pg_get_function_result(oid) AS returns,
  prosecdef AS security_definer,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'issue_student_link_code'
  AND pronamespace = 'public'::regnamespace;

SELECT '======== 2/5 함수: claim_student_link_code ========' AS section_header;
SELECT
  proname AS name,
  pg_get_function_arguments(oid) AS args,
  pg_get_function_result(oid) AS returns,
  prosecdef AS security_definer,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'claim_student_link_code'
  AND pronamespace = 'public'::regnamespace;

SELECT '======== 3/5 함수: preview_student_link_code ========' AS section_header;
SELECT
  proname AS name,
  pg_get_function_arguments(oid) AS args,
  pg_get_function_result(oid) AS returns,
  prosecdef AS security_definer,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'preview_student_link_code'
  AND pronamespace = 'public'::regnamespace;

SELECT '======== 4/5 함수: create_guardian_invitation ========' AS section_header;
SELECT
  proname AS name,
  pg_get_function_arguments(oid) AS args,
  pg_get_function_result(oid) AS returns,
  prosecdef AS security_definer,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'create_guardian_invitation'
  AND pronamespace = 'public'::regnamespace;

SELECT '======== 5/5 함수: redeem_guardian_invitation ========' AS section_header;
SELECT
  proname AS name,
  pg_get_function_arguments(oid) AS args,
  pg_get_function_result(oid) AS returns,
  prosecdef AS security_definer,
  pg_get_functiondef(oid) AS definition
FROM pg_proc
WHERE proname = 'redeem_guardian_invitation'
  AND pronamespace = 'public'::regnamespace;

-- =====================================================================
-- 2. 테이블 스키마: guardian_invitations
-- =====================================================================

SELECT '======== guardian_invitations: 컬럼 정의 ========' AS section_header;
SELECT
  ordinal_position AS pos,
  column_name,
  data_type,
  character_maximum_length AS max_len,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'guardian_invitations'
ORDER BY ordinal_position;

SELECT '======== guardian_invitations: 인덱스 ========' AS section_header;
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'guardian_invitations';

SELECT '======== guardian_invitations: 제약조건 (PK/FK/UNIQUE/CHECK) ========' AS section_header;
SELECT
  conname AS constraint_name,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END AS type,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'guardian_invitations'
ORDER BY contype, conname;

SELECT '======== guardian_invitations: RLS 활성 여부 ========' AS section_header;
SELECT
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE oid = 'public.guardian_invitations'::regclass;

SELECT '======== guardian_invitations: RLS 정책 목록 ========' AS section_header;
SELECT policyname, cmd, permissive, roles::text AS roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'guardian_invitations';

SELECT '======== guardian_invitations: 트리거 ========' AS section_header;
SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.guardian_invitations'::regclass
  AND NOT tgisinternal;

-- =====================================================================
-- 3. 테이블 스키마: student_link_codes
-- =====================================================================

SELECT '======== student_link_codes: 컬럼 정의 ========' AS section_header;
SELECT
  ordinal_position AS pos,
  column_name,
  data_type,
  character_maximum_length AS max_len,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'student_link_codes'
ORDER BY ordinal_position;

SELECT '======== student_link_codes: 인덱스 ========' AS section_header;
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'student_link_codes';

SELECT '======== student_link_codes: 제약조건 (PK/FK/UNIQUE/CHECK) ========' AS section_header;
SELECT
  conname AS constraint_name,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END AS type,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'student_link_codes'
ORDER BY contype, conname;

SELECT '======== student_link_codes: RLS 활성 여부 ========' AS section_header;
SELECT
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE oid = 'public.student_link_codes'::regclass;

SELECT '======== student_link_codes: RLS 정책 목록 ========' AS section_header;
SELECT policyname, cmd, permissive, roles::text AS roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'student_link_codes';

SELECT '======== student_link_codes: 트리거 ========' AS section_header;
SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.student_link_codes'::regclass
  AND NOT tgisinternal;

-- =====================================================================
-- 4. 보너스: 기존 코드 길이 분포 (호환성 영향도 측정)
--    아래 두 쿼리는 컬럼명이 다르면 에러날 수 있어요. 위 1~3 결과만으로 충분하면 무시하셔도 됩니다.
-- =====================================================================

SELECT '======== student_link_codes: 코드 길이별 행 수 ========' AS section_header;
SELECT
  length(code) AS code_length,
  count(*) AS total_rows,
  count(*) FILTER (WHERE used_at IS NULL AND expires_at > now()) AS active_rows
FROM public.student_link_codes
GROUP BY length(code)
ORDER BY length(code);

SELECT '======== guardian_invitations: 코드 길이별 행 수 ========' AS section_header;
SELECT
  length(invitation_code) AS code_length,
  count(*) AS total_rows,
  count(*) FILTER (WHERE used_at IS NULL AND expires_at > now()) AS active_rows
FROM public.guardian_invitations
GROUP BY length(invitation_code)
ORDER BY length(invitation_code);
