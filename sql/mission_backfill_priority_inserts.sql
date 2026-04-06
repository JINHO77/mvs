-- Priority backfill missions for the most urgent gaps

insert into generated_missions (
  subject,
  unit_id,
  template_id,
  title,
  difficulty,
  estimated_minutes,
  source_type,
  status,
  mission_json,
  quality_notes,
  created_by,
  reviewed_by,
  reviewed_at,
  published_at,
  is_active
)
select
  payload.subject,
  cu.id as unit_id,
  null as template_id,
  payload.title,
  payload.difficulty,
  payload.estimated_minutes,
  'manual' as source_type,
  'published' as status,
  payload.mission_json,
  payload.quality_notes,
  null as created_by,
  null as reviewed_by,
  null as reviewed_at,
  now() as published_at,
  true as is_active
from (
  values
    (
      'english',
      'mid-eng-past-experience',
      '지난 주말 활동을 순서대로 말해보자',
      'easy',
      12,
      $${
        "title": "지난 주말 활동을 순서대로 말해보자",
        "scenario": "친구가 주말에 무엇을 했는지 간단한 대화를 읽고 핵심 활동을 순서대로 이해하는 영어 미션",
        "difficulty": "easy",
        "missionKey": "eng_mid1_past_experience_easy_v1",
        "mainConcept": "past_experience_sequence",
        "conceptTags": ["english", "past", "experience", "sequence", "weekend"],
        "learningGoal": "간단한 과거 경험 문장을 읽고 순서와 핵심 정보를 파악할 수 있다.",
        "conceptSummary": "과거 경험 읽기에서는 활동 동사와 시간 순서 표현을 먼저 잡으면 흐름이 보인다.",
        "realLifeContext": "주말 경험 대화 읽기",
        "supportConcepts": ["past_tense", "time_order", "daily_experience"],
        "estimatedMinutes": 12,
        "essentialQuestion": "짧은 경험 이야기를 읽고 먼저 한 일과 나중에 한 일을 구분할 수 있을까?",
        "steps": [
          {
            "stepOrder": 1,
            "stepType": "concept",
            "title": "상황 이해",
            "content": "I visited my grandma, played badminton, and watched a movie. 같은 문장은 한 사람이 한 일을 순서대로 말해 줍니다.",
            "hints": [
              { "level": 1, "text": "문장 속 동사를 먼저 찾아보세요." },
              { "level": 2, "text": "각 활동을 짧은 한국어로 바꿔 보세요." },
              { "level": 3, "text": "무엇을 했는지 순서대로 다시 읽어 보세요." }
            ],
            "solution": {
              "summary": "경험 이야기 읽기는 활동 동사와 순서를 먼저 잡는 것이 핵심입니다.",
              "concept": "visited, played, watched 같은 동사를 찾으면 무엇을 했는지 빠르게 이해할 수 있습니다.",
              "steps": ["활동 동사를 찾습니다.", "먼저 한 일과 나중에 한 일을 구분합니다.", "전체 흐름을 다시 말해 봅니다."]
            }
          },
          {
            "stepOrder": 2,
            "stepType": "choice",
            "title": "핵심 활동 찾기",
            "prompt": "가장 알맞은 것을 고르세요.",
            "question": "Minho visited his grandma and played badminton. 에서 Minho가 한 일은 무엇일까요?",
            "choices": ["할머니를 뵙고 배드민턴을 했다.", "할머니와 영화를 봤다.", "학교에서 숙제를 했다."],
            "correctAnswer": "할머니를 뵙고 배드민턴을 했다.",
            "explanation": "visited his grandma 와 played badminton 가 핵심 활동입니다.",
            "hints": [
              { "level": 1, "text": "visited 와 played 의 뜻을 떠올려 보세요." },
              { "level": 2, "text": "문장 안에 나온 활동 두 개를 연결해 보세요." },
              { "level": 3, "text": "할머니 방문 + 배드민턴이 답입니다." }
            ],
            "solution": {
              "summary": "핵심 동사를 읽으면 경험 문장의 뜻을 빠르게 이해할 수 있습니다.",
              "concept": "visited 는 방문했다, played badminton 는 배드민턴을 했다 입니다.",
              "steps": ["동사를 찾습니다.", "뜻을 짧게 바꿉니다.", "활동을 자연스럽게 연결합니다."]
            }
          },
          {
            "stepOrder": 3,
            "stepType": "choice",
            "title": "순서 파악",
            "prompt": "먼저 한 활동을 고르세요.",
            "question": "Jiyoon cleaned her desk and then called her friend. 에서 먼저 한 일은 무엇일까요?",
            "choices": ["책상을 정리했다.", "친구에게 전화했다.", "간식을 먹었다."],
            "correctAnswer": "책상을 정리했다.",
            "explanation": "then 앞의 cleaned her desk 가 먼저 한 일입니다.",
            "hints": [
              { "level": 1, "text": "then 이 앞뒤 순서를 나눕니다." },
              { "level": 2, "text": "앞 활동이 먼저입니다." },
              { "level": 3, "text": "cleaned her desk 가 먼저입니다." }
            ],
            "solution": {
              "summary": "then 은 행동 순서를 알려 주는 중요한 단서입니다.",
              "concept": "then 앞의 행동을 먼저 읽고 뒤 행동을 나중에 읽습니다.",
              "steps": ["순서 표현을 찾습니다.", "앞과 뒤 활동을 나눕니다.", "먼저 한 활동을 선택합니다."]
            }
          },
          {
            "stepOrder": 4,
            "stepType": "choice",
            "title": "이유 연결",
            "prompt": "가장 알맞은 것을 고르세요.",
            "question": "I stayed home because it rained. 의 뜻은 무엇일까요?",
            "choices": ["비가 와서 집에 있었다.", "비를 보러 밖에 나갔다.", "친구와 운동장에 갔다."],
            "correctAnswer": "비가 와서 집에 있었다.",
            "explanation": "because it rained 는 이유를, stayed home 은 결과를 말합니다.",
            "hints": [
              { "level": 1, "text": "because 뒤는 이유입니다." },
              { "level": 2, "text": "stayed home 과 it rained 를 각각 해석해 보세요." },
              { "level": 3, "text": "비가 와서 집에 있었다가 자연스럽습니다." }
            ],
            "solution": {
              "summary": "because 는 경험 이야기에서 이유를 연결하는 표현입니다.",
              "concept": "이유를 먼저 이해하면 행동의 의미를 더 정확히 읽을 수 있습니다.",
              "steps": ["이유를 찾습니다.", "행동을 해석합니다.", "이유와 행동을 연결합니다."]
            }
          },
          {
            "stepOrder": 5,
            "stepType": "concept",
            "title": "개념 정리",
            "content": "과거 경험 읽기에서는 활동 동사, 순서 표현, 이유 표현을 함께 보면 이야기 흐름이 더 잘 보입니다.",
            "hints": [
              { "level": 1, "text": "동사, 순서, 이유를 차례로 확인해 보세요." },
              { "level": 2, "text": "한 문장씩 끊어 읽으면 구조가 더 보입니다." },
              { "level": 3, "text": "무엇을 했는지, 어떤 순서인지, 왜 그랬는지로 나눠 보세요." }
            ],
            "solution": {
              "summary": "경험 이야기 읽기는 동사-순서-이유를 함께 보는 습관이 중요합니다.",
              "concept": "짧은 경험 문장도 흐름을 나눠 읽으면 시험형 읽기와 실생활 이해를 함께 대비할 수 있습니다.",
              "steps": ["활동 동사를 찾습니다.", "순서를 확인합니다.", "이유를 연결합니다."]
            }
          }
        ]
      }$$::jsonb,
      'Backfill: review easy mission for middle grade 1 past-experience route'
    ),
    (
      'english',
      'mid-eng-advice-problem-solving',
      '친구에게 가장 쉬운 조언을 해보자',
      'easy',
      12,
      $${
        "title": "친구에게 가장 쉬운 조언을 해보자",
        "scenario": "친구의 간단한 고민을 읽고 should 표현으로 바로 쓸 수 있는 쉬운 조언을 고르는 영어 미션",
        "difficulty": "easy",
        "missionKey": "eng_mid2_advice_easy_v1",
        "mainConcept": "basic_advice_should",
        "conceptTags": ["english", "should", "advice", "problem_solving", "middle2"],
        "learningGoal": "간단한 문제 상황에 맞는 쉬운 조언 표현을 읽고 고를 수 있다.",
        "conceptSummary": "should + 동사원형은 상대에게 가장 기본적인 조언을 할 때 쓰는 표현입니다.",
        "realLifeContext": "친구 고민 조언하기",
        "supportConcepts": ["should", "verb_base_form", "daily_problem_solving"],
        "estimatedMinutes": 12,
        "essentialQuestion": "문제 상황을 읽고 should로 시작하는 알맞은 조언을 고를 수 있을까?",
        "steps": [
          {
            "stepOrder": 1,
            "stepType": "concept",
            "title": "표현 익히기",
            "content": "You should go to bed earlier. 는 '너는 더 일찍 자는 게 좋겠어.' 라는 기본 조언 표현입니다.",
            "hints": [
              { "level": 1, "text": "should 뒤에는 동사원형이 온다는 점을 떠올려 보세요." },
              { "level": 2, "text": "문제 상황에 맞는 가장 직접적인 행동을 생각해 보세요." },
              { "level": 3, "text": "바로 해볼 수 있는 행동이 쉬운 조언입니다." }
            ],
            "solution": {
              "summary": "쉬운 조언 문제에서는 should 뒤의 행동이 상황과 맞는지가 가장 중요합니다.",
              "concept": "should + 동사원형 구조를 익히면 기본 조언 문장을 빠르게 이해할 수 있습니다.",
              "steps": ["문제 상황을 읽습니다.", "직접적인 해결 행동을 떠올립니다.", "should 표현과 연결합니다."]
            }
          },
          {
            "stepOrder": 2,
            "stepType": "choice",
            "title": "수면 조언",
            "prompt": "가장 알맞은 문장을 고르세요.",
            "question": "늘 피곤하다고 말하는 친구에게 가장 알맞은 조언은 무엇일까요?",
            "choices": ["You should go to bed earlier.", "You should be later bed.", "You should no sleep."],
            "correctAnswer": "You should go to bed earlier.",
            "explanation": "피곤할 때는 더 일찍 자라는 조언이 가장 자연스럽습니다.",
            "hints": [
              { "level": 1, "text": "피곤함을 줄이는 가장 쉬운 행동을 생각해 보세요." },
              { "level": 2, "text": "go to bed earlier 가 문제 해결과 직접 연결됩니다." },
              { "level": 3, "text": "should + go 구조도 자연스럽습니다." }
            ],
            "solution": {
              "summary": "문제 상황과 직접 연결되는 쉬운 행동을 고르면 됩니다.",
              "concept": "go to bed earlier 는 피곤함 해결과 가장 자연스럽게 연결됩니다.",
              "steps": ["문제 원인을 파악합니다.", "쉬운 해결 행동을 떠올립니다.", "자연스러운 문장을 고릅니다."]
            }
          },
          {
            "stepOrder": 3,
            "stepType": "choice",
            "title": "숙제 조언",
            "prompt": "가장 알맞은 문장을 고르세요.",
            "question": "숙제를 자꾸 잊어버리는 친구에게 가장 알맞은 조언은 무엇일까요?",
            "choices": ["You should write it in your planner.", "You should forget your homework.", "You should planner write."],
            "correctAnswer": "You should write it in your planner.",
            "explanation": "planner에 적는 행동이 숙제를 잊는 문제를 가장 직접적으로 도와줍니다.",
            "hints": [
              { "level": 1, "text": "잊지 않으려면 기록하는 행동이 필요합니다." },
              { "level": 2, "text": "write it in your planner 를 떠올려 보세요." },
              { "level": 3, "text": "should 뒤에 write 가 바로 오는 구조를 확인해 보세요." }
            ],
            "solution": {
              "summary": "기록하기는 학교생활 문제를 해결하는 대표적인 쉬운 조언입니다.",
              "concept": "planner 는 계획과 할 일을 적는 도구라서 숙제 문제와 잘 맞습니다.",
              "steps": ["문제 상황을 확인합니다.", "바로 실천할 행동을 찾습니다.", "문장 구조를 점검합니다."]
            }
          },
          {
            "stepOrder": 4,
            "stepType": "choice",
            "title": "의미 이해",
            "prompt": "뜻이 가장 알맞은 것을 고르세요.",
            "question": "'You should ask your friend first.'의 뜻은 무엇일까요?",
            "choices": ["먼저 친구에게 물어보는 게 좋겠어.", "친구를 피하는 게 좋겠어.", "친구에게 늦게 가는 게 좋겠어."],
            "correctAnswer": "먼저 친구에게 물어보는 게 좋겠어.",
            "explanation": "ask your friend first 는 먼저 친구에게 물어보라는 뜻입니다.",
            "hints": [
              { "level": 1, "text": "ask 의 뜻을 떠올려 보세요." },
              { "level": 2, "text": "first 는 순서상 먼저를 뜻합니다." },
              { "level": 3, "text": "친구에게 먼저 물어보는 것이 가장 자연스러운 해석입니다." }
            ],
            "solution": {
              "summary": "쉬운 조언 표현은 직역해도 의미가 비교적 분명하게 드러납니다.",
              "concept": "ask + 사람 은 누구에게 물어보다 라는 기본 표현입니다.",
              "steps": ["핵심 동사를 찾습니다.", "순서 표현을 해석합니다.", "문장 전체 뜻을 연결합니다."]
            }
          },
          {
            "stepOrder": 5,
            "stepType": "concept",
            "title": "개념 정리",
            "content": "좋은 쉬운 조언은 문제를 바로 줄여 주는 간단한 행동을 should와 함께 제안하는 것입니다.",
            "hints": [
              { "level": 1, "text": "문제와 행동을 직접 연결해 보세요." },
              { "level": 2, "text": "어려운 설명보다 바로 할 수 있는 행동이 쉽습니다." },
              { "level": 3, "text": "should + 동사원형 구조를 반복해서 확인해 보세요." }
            ],
            "solution": {
              "summary": "쉬운 조언 미션은 should 표현을 상황에 맞게 연결하는 연습입니다.",
              "concept": "기본 조언 표현이 익숙해지면 이후 비교, 이유, 선택형 문제로 자연스럽게 확장할 수 있습니다.",
              "steps": ["문제 상황을 읽습니다.", "가장 쉬운 해결 행동을 찾습니다.", "should 문장으로 연결합니다."]
            }
          }
        ]
      }$$::jsonb,
      'Backfill: current easy mission for middle grade 2 advice route'
    ),
    (
      'math',
      'elem-5-fraction-add-subtract',
      '분수의 크기를 맞춰 간식 양을 비교해 보자',
      'easy',
      11,
      $${
        "title": "분수의 크기를 맞춰 간식 양을 비교해 보자",
        "scenario": "분모가 다른 두 간식 양을 같은 기준으로 바꾸어 비교하는 수학 미션",
        "difficulty": "easy",
        "missionKey": "math_elem5_fraction_add_subtract_easy_v1",
        "mainConcept": "fraction_common_denominator_basic",
        "conceptTags": ["math", "fraction", "common_denominator", "comparison", "elementary5"],
        "learningGoal": "분모가 다른 분수를 같은 기준으로 바꾸어 비교할 수 있다.",
        "conceptSummary": "분모가 다르면 같은 크기 조각 기준으로 바꾼 뒤 분자를 비교해야 한다.",
        "realLifeContext": "간식 양 비교",
        "supportConcepts": ["common_denominator", "fraction_comparison", "equivalent_fraction"],
        "estimatedMinutes": 11,
        "essentialQuestion": "분모가 다를 때 어떻게 같은 기준으로 바꾸어 양을 비교할 수 있을까?",
        "steps": [
          {
            "stepOrder": 1,
            "stepType": "concept",
            "title": "기준 맞추기",
            "content": "1/2 와 2/4 는 같은 양입니다. 조각 기준을 같게 바꾸면 비교가 쉬워집니다.",
            "hints": [
              { "level": 1, "text": "분모가 다르면 조각 크기가 다르다는 점을 먼저 떠올려 보세요." },
              { "level": 2, "text": "둘 다 같은 분모로 바꿀 수 있는 수를 찾아보세요." },
              { "level": 3, "text": "분모를 같게 만든 뒤 분자를 비교하면 됩니다." }
            ],
            "solution": {
              "summary": "분수 비교는 같은 기준 조각으로 맞추는 것이 첫 단계입니다.",
              "concept": "공통분모를 만들면 같은 크기 조각끼리 비교할 수 있습니다.",
              "steps": ["분모를 확인합니다.", "같은 분모로 바꿉니다.", "분자를 비교합니다."]
            }
          },
          {
            "stepOrder": 2,
            "stepType": "choice",
            "title": "같은 분모 만들기",
            "prompt": "가장 알맞은 것을 고르세요.",
            "question": "1/2 를 분모가 4인 분수로 바꾸면 무엇일까요?",
            "choices": ["2/4", "1/4", "3/4"],
            "correctAnswer": "2/4",
            "explanation": "1/2 는 같은 양으로 2/4 로 바꿀 수 있습니다.",
            "hints": [
              { "level": 1, "text": "분모가 2에서 4로 두 배가 되었습니다." },
              { "level": 2, "text": "같은 양을 유지하려면 분자도 같은 배수로 바꿉니다." },
              { "level": 3, "text": "1과 2를 모두 2배 하면 2/4 입니다." }
            ],
            "solution": {
              "summary": "같은 양을 유지하려면 분자와 분모를 같은 수로 곱해야 합니다.",
              "concept": "1/2 = 2/4 는 대표적인 동치분수입니다.",
              "steps": ["분모 변화량을 확인합니다.", "분자도 같은 배수로 바꿉니다.", "동치분수인지 확인합니다."]
            }
          },
          {
            "stepOrder": 3,
            "stepType": "choice",
            "title": "양 비교",
            "prompt": "더 큰 것을 고르세요.",
            "question": "3/4 와 2/3 중 더 큰 분수는 무엇일까요?",
            "choices": ["3/4", "2/3", "같다"],
            "correctAnswer": "3/4",
            "explanation": "3/4 = 9/12, 2/3 = 8/12 이므로 3/4 가 더 큽니다.",
            "hints": [
              { "level": 1, "text": "두 분수의 분모를 12로 맞춰 보세요." },
              { "level": 2, "text": "3/4 는 9/12, 2/3 은 8/12 입니다." },
              { "level": 3, "text": "같은 분모에서는 분자가 큰 쪽이 더 큽니다." }
            ],
            "solution": {
              "summary": "공통분모를 만들면 더 큰 분수를 쉽게 찾을 수 있습니다.",
              "concept": "같은 분모일 때는 분자만 비교하면 됩니다.",
              "steps": ["공통분모를 정합니다.", "각 분수를 동치분수로 바꿉니다.", "분자를 비교합니다."]
            }
          },
          {
            "stepOrder": 4,
            "stepType": "input",
            "title": "합 구하기",
            "prompt": "답을 분수로 입력하세요.",
            "question": "1/4 + 2/4 = ?",
            "correctAnswer": "3/4",
            "answerType": "text",
            "explanation": "분모가 같으므로 분자만 더하면 3/4 입니다.",
            "hints": [
              { "level": 1, "text": "분모가 같은지 먼저 보세요." },
              { "level": 2, "text": "같은 분모면 분자는 1 + 2 로 계산합니다." },
              { "level": 3, "text": "분모 4는 그대로 두고 분자를 더하면 됩니다." }
            ],
            "solution": {
              "summary": "같은 분모의 덧셈은 분자만 더하는 기본 원리로 해결합니다.",
              "concept": "조각 크기는 그대로 두고 조각 수만 합칩니다.",
              "steps": ["분모가 같은지 확인합니다.", "분자끼리 더합니다.", "분모는 그대로 둡니다."]
            }
          },
          {
            "stepOrder": 5,
            "stepType": "concept",
            "title": "개념 정리",
            "content": "분수의 비교와 덧셈은 같은 기준 조각으로 맞추는 습관이 가장 중요합니다.",
            "hints": [
              { "level": 1, "text": "항상 분모를 먼저 보세요." },
              { "level": 2, "text": "분모가 다르면 공통분모를 떠올려 보세요." },
              { "level": 3, "text": "같은 기준 조각이 되면 비교와 계산이 쉬워집니다." }
            ],
            "solution": {
              "summary": "공통분모는 분수 단원 전체를 이어 주는 핵심 도구입니다.",
              "concept": "기준을 먼저 맞추는 습관이 있으면 비교, 덧셈, 뺄셈 모두 훨씬 안정적으로 풀 수 있습니다.",
              "steps": ["분모를 확인합니다.", "필요하면 같은 기준으로 맞춥니다.", "그 뒤에 비교하거나 계산합니다."]
            }
          }
        ]
      }$$::jsonb,
      'Backfill: easy mission for elementary grade 5 fraction add/subtract gap'
    ),
    (
      'math',
      'elem-6-circle',
      '원 둘레를 이용해 운동장 길이를 구해보자',
      'easy',
      11,
      $${
        "title": "원 둘레를 이용해 운동장 길이를 구해보자",
        "scenario": "원 모양 운동장을 한 바퀴 도는 길이를 원의 둘레 개념으로 구하는 수학 미션",
        "difficulty": "easy",
        "missionKey": "math_elem6_circle_easy_v1",
        "mainConcept": "circle_circumference_basic",
        "conceptTags": ["math", "circle", "circumference", "elementary6", "measurement"],
        "learningGoal": "반지름과 지름을 보고 원의 둘레를 구하는 기본 원리를 이해할 수 있다.",
        "conceptSummary": "원의 둘레는 지름과 원주율을 이용해 구하며, 실제 길이 문제에 자주 적용된다.",
        "realLifeContext": "원형 운동장 길이 계산",
        "supportConcepts": ["diameter", "radius", "pi"],
        "estimatedMinutes": 11,
        "essentialQuestion": "원 한 바퀴의 길이는 지름과 어떤 관계가 있을까?",
        "steps": [
          {
            "stepOrder": 1,
            "stepType": "concept",
            "title": "기본 개념",
            "content": "원의 둘레는 보통 지름 × 3.14 로 구합니다.",
            "hints": [
              { "level": 1, "text": "반지름과 지름의 관계를 먼저 떠올려 보세요." },
              { "level": 2, "text": "지름은 반지름의 두 배입니다." },
              { "level": 3, "text": "둘레는 지름 × 3.14 입니다." }
            ],
            "solution": {
              "summary": "원의 길이 문제는 지름을 먼저 찾는 것이 핵심입니다.",
              "concept": "반지름을 알면 지름을 구하고, 지름으로 둘레를 계산합니다.",
              "steps": ["반지름과 지름을 구분합니다.", "필요하면 지름을 구합니다.", "지름 × 3.14 를 적용합니다."]
            }
          },
          {
            "stepOrder": 2,
            "stepType": "choice",
            "title": "지름 찾기",
            "prompt": "가장 알맞은 것을 고르세요.",
            "question": "반지름이 5m인 원의 지름은 얼마일까요?",
            "choices": ["10m", "5m", "15m"],
            "correctAnswer": "10m",
            "explanation": "지름은 반지름의 두 배이므로 10m 입니다.",
            "hints": [
              { "level": 1, "text": "지름은 반지름의 몇 배인지 생각해 보세요." },
              { "level": 2, "text": "반지름 5m를 두 번 더하면 지름입니다." },
              { "level": 3, "text": "5 × 2 = 10 입니다." }
            ],
            "solution": {
              "summary": "원의 기본 길이 문제는 지름부터 정확히 찾는 것이 중요합니다.",
              "concept": "지름은 원의 중심을 지나 양쪽 끝을 잇는 길이입니다.",
              "steps": ["반지름 값을 확인합니다.", "두 배를 계산합니다.", "단위를 함께 씁니다."]
            }
          },
          {
            "stepOrder": 3,
            "stepType": "input",
            "title": "둘레 계산",
            "prompt": "숫자만 입력하세요.",
            "question": "지름이 10m인 원의 둘레는 약 몇 m일까요?",
            "correctAnswer": 31.4,
            "answerType": "number",
            "explanation": "10 × 3.14 = 31.4 이므로 둘레는 약 31.4m 입니다.",
            "hints": [
              { "level": 1, "text": "둘레 공식은 지름 × 3.14 입니다." },
              { "level": 2, "text": "지름 10에 3.14를 곱해 보세요." },
              { "level": 3, "text": "10 × 3.14 = 31.4 입니다." }
            ],
            "solution": {
              "summary": "원의 둘레는 지름과 원주율을 곱해 빠르게 구할 수 있습니다.",
              "concept": "지름이 커질수록 둘레도 같은 비율로 커집니다.",
              "steps": ["지름을 확인합니다.", "3.14를 곱합니다.", "길이 단위로 해석합니다."]
            }
          },
          {
            "stepOrder": 4,
            "stepType": "choice",
            "title": "실생활 해석",
            "prompt": "가장 알맞은 것을 고르세요.",
            "question": "원형 운동장을 한 바퀴 도는 길이를 구할 때 필요한 값은 무엇일까요?",
            "choices": ["지름", "높이", "넓이"],
            "correctAnswer": "지름",
            "explanation": "원의 둘레는 지름을 이용해 구합니다.",
            "hints": [
              { "level": 1, "text": "한 바퀴 길이는 둘레와 관련 있습니다." },
              { "level": 2, "text": "둘레 공식에 들어가는 값을 떠올려 보세요." },
              { "level": 3, "text": "지름 × 3.14 공식의 핵심 값은 지름입니다." }
            ],
            "solution": {
              "summary": "실생활 길이 문제는 공식에 필요한 핵심 값을 정확히 고르는 것이 중요합니다.",
              "concept": "원의 둘레는 높이나 넓이가 아니라 지름과 직접 연결됩니다.",
              "steps": ["문제가 둘레인지 넓이인지 구분합니다.", "해당 공식의 핵심 값을 찾습니다.", "알맞은 값을 선택합니다."]
            }
          },
          {
            "stepOrder": 5,
            "stepType": "concept",
            "title": "개념 정리",
            "content": "원 길이 문제는 지름을 찾고 3.14를 곱하는 흐름을 익히면 훨씬 쉽게 해결할 수 있습니다.",
            "hints": [
              { "level": 1, "text": "반지름-지름-둘레 순서로 정리해 보세요." },
              { "level": 2, "text": "공식이 언제 필요한지 상황과 연결해 보세요." },
              { "level": 3, "text": "운동장, 바퀴, 원형 트랙처럼 한 바퀴 길이는 둘레와 연결됩니다." }
            ],
            "solution": {
              "summary": "원의 둘레는 실제 측정 문제와 연결되는 대표 개념입니다.",
              "concept": "지름을 먼저 찾는 습관이 있으면 원 문제를 훨씬 안정적으로 해결할 수 있습니다.",
              "steps": ["반지름과 지름을 구분합니다.", "지름을 찾습니다.", "둘레 공식에 적용합니다."]
            }
          }
        ]
      }$$::jsonb,
      'Backfill: easy mission for elementary grade 6 circle gap'
    )
) as payload(subject, unit_key, title, difficulty, estimated_minutes, mission_json, quality_notes)
join curriculum_units cu
  on cu.unit_key = payload.unit_key
 and cu.subject = payload.subject
where cu.is_active = true
  and not exists (
    select 1
    from generated_missions gm
    where gm.unit_id = cu.id
      and gm.subject = payload.subject
      and (
        gm.mission_json ->> 'missionKey' = payload.mission_json ->> 'missionKey'
        or gm.mission_json ->> 'mission_key' = payload.mission_json ->> 'missionKey'
      )
  );
