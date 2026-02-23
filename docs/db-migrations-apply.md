# DB Migrations Apply Guide

## 실행 순서 (Supabase SQL Editor)
아래 순서대로 실행합니다.

1. `supabase/migrations/20260222_01_rls_consultation_requests.sql`
2. `supabase/migrations/20260222_02_rls_student_guardians.sql`
3. `supabase/migrations/20260222_03_consultation_requests_not_null_fk_readiness.sql`

## 실행 직후 검증 쿼리

### 1) consultation_requests의 student_id NULL 개수
```sql
select count(*) as consultation_requests_student_id_null_count
from public.consultation_requests
where student_id is null;
```

### 2) student_guardians 연결 데이터 존재 여부 (전체 카운트)
```sql
select count(*) as student_guardians_count
from public.student_guardians;
```

### 3) consultation_requests INSERT가 RLS에 의해 제한되는지 테스트 절차
실제 운영 데이터에 영향을 줄 수 있으므로 테스트 계정/테스트 데이터로 확인합니다.

1. parent 계정 A로 로그인한 세션에서, A와 연결되지 않은 `student_id`를 준비
2. 아래 예시 INSERT 실행 (예시는 실패해야 정상)
```sql
insert into public.consultation_requests (
  guardian_id,
  student_id,
  requested_start_at,
  duration_min,
  type,
  status
) values (
  auth.uid(),
  '00000000-0000-0000-0000-000000000000', -- 연결되지 않은 학생 ID 예시
  now() + interval '1 day',
  30,
  'phone',
  'requested'
);
```
3. 기대 결과: RLS 정책(`cr_parent_insert_own_students`)에 의해 INSERT 거부

## 중요 경고: NOT NULL / FK는 readiness 통과 후 적용
- `consultation_requests.student_id`의 NULL 개수가 0이 되기 전에는 `NOT NULL` 강제 금지
- FK는 실제 참조 대상 테이블(`profiles` 또는 별도 학생 테이블) 확인 후 적용
- 즉시 강제 대신, readiness 파일의 점검 쿼리 결과를 기준으로 2단계에서 반영

