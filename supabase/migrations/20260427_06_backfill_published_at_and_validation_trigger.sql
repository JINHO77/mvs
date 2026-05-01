-- 1) published_at NULL backfill
UPDATE generated_missions
SET published_at = COALESCE(created_at, now())
WHERE status = 'published'
  AND is_active = true
  AND published_at IS NULL;

-- 2) MatchMind subject 정정
UPDATE generated_missions
SET subject = 'math'
WHERE title = 'MatchMind: 합집합·교집합으로 완벽한 매칭을 만들어라!'
  AND subject = 'english';

-- 3) path entry 검증 트리거
CREATE OR REPLACE FUNCTION public.fn_validate_path_recommendation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_mission RECORD;
BEGIN
  IF NOT NEW.is_active OR NEW.mission_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, status, is_active, published_at, subject INTO v_mission
  FROM generated_missions WHERE id = NEW.mission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '미션이 존재하지 않습니다: %', NEW.mission_id;
  END IF;
  IF v_mission.status != 'published' THEN
    RAISE EXCEPTION '미션 status != published: %', NEW.mission_id;
  END IF;
  IF NOT v_mission.is_active THEN
    RAISE EXCEPTION '미션 비활성: %', NEW.mission_id;
  END IF;
  IF v_mission.published_at IS NULL THEN
    RAISE EXCEPTION '미션 published_at NULL: %', NEW.mission_id;
  END IF;
  IF NEW.subject IS NOT NULL AND v_mission.subject IS NOT NULL
     AND NEW.subject != v_mission.subject THEN
    RAISE EXCEPTION 'subject 불일치: path=%, mission=%', NEW.subject, v_mission.subject;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_path_recommendation
  ON public.learning_path_recommendations;

CREATE TRIGGER trg_validate_path_recommendation
  BEFORE INSERT OR UPDATE ON public.learning_path_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_path_recommendation();
