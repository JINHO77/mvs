alter table public.generated_missions
add column if not exists subject text not null default 'math';

alter table public.generated_missions
drop constraint if exists generated_missions_subject_check;

alter table public.generated_missions
add constraint generated_missions_subject_check
check (subject in ('math', 'english'));
