INSERT INTO generated_missions (
  unit_id, source_type, status, subject, title, scenario,
  difficulty, estimated_minutes, mission_json, interest_tags, is_active
) VALUES

-- =============================================
-- 중1(7학년) 경험과 일상 이야기 easy 2개
-- =============================================
(
  '29b6ebcb-5d22-45dd-bf7e-2c663fa701a7',
  'ai', 'published', 'english',
  '주말에 뭐 했어? 경험 말하기',
  '영어 수업 시간에 선생님이 "What did you do last weekend?"라고 물어봤다. 짝꿍에게 지난 주말 경험을 영어로 말해보자.',
  'easy', 12,
  $json${
    "missionKey": "eng_mid1_exp_easy_weekend_v1",
    "intro": {"text": "과거 경험을 말할 때는 동사의 과거형을 써. go→went, eat→ate, watch→watched처럼 변해!"},
    "activities": [
      {
        "type": "concept_check",
        "prompt": "다음 동사의 과거형을 써봐: go, watch, eat",
        "answer": "went, watched, ate",
        "hints": [
          "go는 불규칙 변화: go → went야.",
          "watch는 규칙 변화: watch → watched (ed 추가)야.",
          "eat는 불규칙 변화: eat → ate야."
        ],
        "explanation": "규칙 동사는 ed를 붙이고(watch→watched), 불규칙 동사는 따로 외워야 해(go→went, eat→ate)."
      },
      {
        "type": "multiple_choice",
        "prompt": "\"나는 지난 주말에 영화를 봤어.\"를 영어로 하면?",
        "options": [
          "I watch a movie last weekend.",
          "I watched a movie last weekend.",
          "I am watching a movie last weekend.",
          "I will watch a movie last weekend."
        ],
        "answer": 1,
        "hints": [
          "힌트1 → 지난 주말은 과거야. 과거형 동사를 써야 해.",
          "힌트2 → watch의 과거형은 watched야.",
          "힌트3 → I watched a movie last weekend.가 맞아."
        ],
        "explanation": "과거 일을 말할 때는 동사 과거형을 써. ①watch는 현재형, ③am watching은 현재진행형, ④will watch는 미래형 오답이야."
      },
      {
        "type": "short_answer",
        "prompt": "\"나는 친구들과 축구를 했어.\"를 영어로 써봐. (play의 과거형: played)",
        "answer": "I played soccer with my friends.",
        "hints": [
          "힌트1 → 주어는 I, 동사 과거형은 played야.",
          "힌트2 → 축구 = soccer, 친구들과 = with my friends야.",
          "힌트3 → I played soccer with my friends.야."
        ],
        "explanation": "I played soccer with my friends. play는 규칙 동사라 ed를 붙여 played가 돼. with는 ~와 함께라는 뜻이야."
      }
    ]
  }$json$::jsonb,
  ARRAY['일상', '스포츠', '학교'],
  true
),
(
  '29b6ebcb-5d22-45dd-bf7e-2c663fa701a7',
  'ai', 'published', 'english',
  '내 일상 루틴 영어로 말하기',
  '외국인 친구 Alex가 "What do you usually do after school?"이라고 물어봤다. 나의 방과 후 일상을 영어로 말해보자.',
  'easy', 12,
  $json${
    "missionKey": "eng_mid1_exp_easy_routine_v1",
    "intro": {"text": "일상적으로 하는 일을 말할 때는 현재형을 써. usually(보통), always(항상), sometimes(가끔) 같은 빈도부사와 함께 쓰면 더 자연스러워!"},
    "activities": [
      {
        "type": "multiple_choice",
        "prompt": "\"나는 보통 학교 끝나고 공부해.\"를 영어로 하면?",
        "options": [
          "I usually study after school.",
          "I usually studied after school.",
          "I am usually study after school.",
          "I usually studying after school."
        ],
        "answer": 0,
        "hints": [
          "힌트1 → 보통 하는 일은 현재형을 써.",
          "힌트2 → usually는 빈도부사로 동사 앞에 와.",
          "힌트3 → I usually study after school.이야."
        ],
        "explanation": "일상적인 습관은 현재형! usually는 일반동사 앞에 위치해. ②studied는 과거형, ③am study는 틀린 표현, ④studying은 동사원형이 아니야."
      },
      {
        "type": "concept_check",
        "prompt": "빈도부사 always, usually, sometimes, never를 빈도 높은 순서로 나열해봐.",
        "answer": "always > usually > sometimes > never",
        "hints": [
          "always = 항상(100%), usually = 보통(80%), sometimes = 가끔(50%), never = 절대 안 함(0%)이야.",
          "높은 것부터: always > usually > sometimes > never야."
        ],
        "explanation": "always(항상) > usually(보통) > sometimes(가끔) > never(절대 안 함) 순이야. 이 순서를 기억해두면 영어 말하기에 바로 쓸 수 있어!"
      },
      {
        "type": "short_answer",
        "prompt": "\"나는 가끔 친구들과 게임을 해.\"를 영어로 써봐.",
        "answer": "I sometimes play games with my friends.",
        "hints": [
          "힌트1 → 가끔 = sometimes, 빈도부사는 동사 앞에 와.",
          "힌트2 → 게임을 하다 = play games야.",
          "힌트3 → I sometimes play games with my friends.야."
        ],
        "explanation": "I sometimes play games with my friends. sometimes는 일반동사(play) 앞에 위치해. 빈도부사 위치: 일반동사 앞, be동사·조동사 뒤!"
      }
    ]
  }$json$::jsonb,
  ARRAY['일상', '게임', '학교'],
  true
),

-- =============================================
-- 중2(8학년) 일상생활과 비교 표현 easy 2개
-- =============================================
(
  'b17ee654-1a98-475f-ae9a-ad4a3c8cf43a',
  'ai', 'published', 'english',
  '더 빠른 건 뭐야? 비교급 기초',
  '친구와 치타와 말 중 어느 동물이 더 빠른지 영어로 말해보자. 비교급을 사용해서 두 가지를 비교하는 표현을 익혀봐.',
  'easy', 13,
  $json${
    "missionKey": "eng_mid2_comp_easy_faster_v1",
    "intro": {"text": "두 가지를 비교할 때는 비교급을 써. 형용사에 -er을 붙이거나 앞에 more를 붙여. 비교 대상 앞에는 than을 써!"},
    "activities": [
      {
        "type": "concept_check",
        "prompt": "다음 형용사의 비교급을 써봐: fast, tall, beautiful",
        "answer": "faster, taller, more beautiful",
        "hints": [
          "짧은 형용사(1~2음절)는 -er 추가: fast→faster, tall→taller야.",
          "긴 형용사(3음절 이상)는 more 추가: beautiful→more beautiful이야."
        ],
        "explanation": "비교급 규칙: 짧은 형용사 + er(fast→faster), 긴 형용사 = more + 형용사(beautiful→more beautiful). 불규칙: good→better, bad→worse야."
      },
      {
        "type": "multiple_choice",
        "prompt": "\"치타는 말보다 더 빨라.\"를 영어로 하면?",
        "options": [
          "A cheetah is fast than a horse.",
          "A cheetah is faster than a horse.",
          "A cheetah is more fast than a horse.",
          "A cheetah is the fastest than a horse."
        ],
        "answer": 1,
        "hints": [
          "힌트1 → 두 가지 비교 = 비교급 + than이야.",
          "힌트2 → fast의 비교급은 faster야.",
          "힌트3 → A cheetah is faster than a horse.야."
        ],
        "explanation": "비교급 = 형용사 + er + than. ①fast는 원급, ③more fast는 틀린 형태(짧은 형용사에 more 불필요), ④the fastest는 최상급이야."
      },
      {
        "type": "short_answer",
        "prompt": "\"내 가방이 네 가방보다 더 무거워.\"를 영어로 써봐. (heavy→heavier)",
        "answer": "My bag is heavier than your bag.",
        "hints": [
          "힌트1 → heavy의 비교급은 heavier야 (y→ier).",
          "힌트2 → 내 가방 = my bag, 네 가방 = your bag이야.",
          "힌트3 → My bag is heavier than your bag.이야."
        ],
        "explanation": "My bag is heavier than your bag. heavy처럼 y로 끝나는 형용사는 y를 i로 바꾸고 er을 붙여(heavy→heavier)."
      }
    ]
  }$json$::jsonb,
  ARRAY['동물', '일상', '스포츠'],
  true
),
(
  'b17ee654-1a98-475f-ae9a-ad4a3c8cf43a',
  'ai', 'published', 'english',
  '우리 동네 vs 도시, 어디가 더 좋아?',
  '영어 토론 시간에 "시골 생활과 도시 생활 중 어느 것이 더 좋아?"라는 주제가 나왔다. 비교 표현을 사용해서 의견을 말해보자.',
  'easy', 13,
  $json${
    "missionKey": "eng_mid2_comp_easy_citylife_v1",
    "intro": {"text": "비교급으로 의견을 말할 때 I think ~ is 비교급 than ~. 패턴을 써봐!"},
    "activities": [
      {
        "type": "multiple_choice",
        "prompt": "\"나는 도시가 시골보다 더 편리하다고 생각해.\"를 영어로 하면?",
        "options": [
          "I think the city is more convenient than the countryside.",
          "I think the city is convenientest than the countryside.",
          "I think the city is more convenient as the countryside.",
          "I think the city is convenient than the countryside."
        ],
        "answer": 0,
        "hints": [
          "힌트1 → convenient는 긴 형용사라 more를 붙여.",
          "힌트2 → 비교 대상 앞에는 than을 써.",
          "힌트3 → more convenient than이 맞아."
        ],
        "explanation": "convenient(4음절)는 more convenient야. ②est는 최상급, ③as는 동등 비교(as~as)에서 쓰는 표현, ④convenient는 원급이야."
      },
      {
        "type": "concept_check",
        "prompt": "\"A는 B만큼 ~해\"를 영어로 표현하는 패턴은?",
        "answer": "A is as 형용사 as B",
        "hints": [
          "동등 비교는 as ~ as 패턴을 써.",
          "예: Seoul is as big as Tokyo. (서울은 도쿄만큼 커)"
        ],
        "explanation": "동등 비교: A is as 형용사 as B. 예) Country life is as peaceful as city life.(시골 생활은 도시 생활만큼 평화로워)"
      },
      {
        "type": "short_answer",
        "prompt": "\"시골은 도시보다 더 조용해.\"를 영어로 써봐. (quiet→quieter)",
        "answer": "The countryside is quieter than the city.",
        "hints": [
          "힌트1 → quiet의 비교급은 quieter야.",
          "힌트2 → 시골 = the countryside, 도시 = the city야.",
          "힌트3 → The countryside is quieter than the city.야."
        ],
        "explanation": "The countryside is quieter than the city. quiet + er = quieter야. 비교급 + than 패턴을 기억해!"
      }
    ]
  }$json$::jsonb,
  ARRAY['사회', '일상', '토론'],
  true
),

-- =============================================
-- 중2(8학년) 문제 해결과 협업 의사소통 easy 2개
-- =============================================
(
  '774096ff-b87c-451c-aeb7-19dab423df32',
  'ai', 'published', 'english',
  '모둠 프로젝트 역할 정하기',
  '영어 수업에서 환경 포스터를 만드는 모둠 프로젝트가 시작됐다. 팀원들과 역할을 나누고 의견을 말하는 영어 표현을 배워보자.',
  'easy', 13,
  $json${
    "missionKey": "eng_mid2_collab_easy_project_v1",
    "intro": {"text": "협업할 때 의견 제안하기: Why don't we~? / How about~? / Let's~! 동의하기: That's a great idea! / I agree. 반대하기: I'm not sure about that."},
    "activities": [
      {
        "type": "concept_check",
        "prompt": "제안하는 표현 3가지를 써봐.",
        "answer": "Why don't we~? / How about~? / Let's~!",
        "hints": [
          "Why don't we + 동사원형? = 우리 ~하는 게 어때?",
          "How about + 동사ing? = ~하는 건 어때?",
          "Let's + 동사원형! = ~하자!"
        ],
        "explanation": "제안 표현: Why don't we make a poster?(포스터 만드는 게 어때?), How about drawing pictures?(그림 그리는 건 어때?), Let's work together!(같이 하자!)"
      },
      {
        "type": "multiple_choice",
        "prompt": "\"우리 역할을 나누는 게 어때?\"를 영어로 하면?",
        "options": [
          "Why don't we divide the roles?",
          "Why don't we dividing the roles?",
          "How about we divide the roles?",
          "Let's to divide the roles."
        ],
        "answer": 0,
        "hints": [
          "힌트1 → Why don't we 뒤에는 동사원형이 와.",
          "힌트2 → divide(나누다)의 동사원형을 써.",
          "힌트3 → Why don't we divide the roles?가 맞아."
        ],
        "explanation": "Why don't we + 동사원형. ②dividing은 동명사형 오답, ③How about we는 How about + 동명사가 맞는 패턴, ④Let's to는 to가 불필요해."
      },
      {
        "type": "short_answer",
        "prompt": "팀원이 좋은 아이디어를 말했을 때 동의하는 표현을 영어로 2개 써봐.",
        "answer": "That's a great idea! / I agree.",
        "hints": [
          "힌트1 → 좋은 아이디어라고 칭찬하는 표현을 생각해봐.",
          "힌트2 → That's a great idea! 또는 I agree.를 써봐.",
          "힌트3 → 둘 다 맞아. Sounds good!도 쓸 수 있어."
        ],
        "explanation": "동의 표현: That's a great idea!(좋은 생각이야!), I agree.(동의해.), Sounds good!(좋아!) 등을 쓸 수 있어. 협업할 때 긍정적 표현이 중요해!"
      }
    ]
  }$json$::jsonb,
  ARRAY['학교', '협업', '프로젝트'],
  true
),
(
  '774096ff-b87c-451c-aeb7-19dab423df32',
  'ai', 'published', 'english',
  '문제 상황 해결책 제안하기',
  '학교 축제 준비 중 문제가 생겼다. 무대 장치가 고장났어! 팀원들과 영어로 해결책을 찾아보자.',
  'easy', 12,
  $json${
    "missionKey": "eng_mid2_collab_easy_solution_v1",
    "intro": {"text": "문제 해결할 때 유용한 표현: We have a problem.(문제가 생겼어.) What should we do?(어떻게 해야 할까?) I think we should~.(~해야 할 것 같아.)"},
    "activities": [
      {
        "type": "multiple_choice",
        "prompt": "\"우리 선생님께 도움을 요청해야 할 것 같아.\"를 영어로 하면?",
        "options": [
          "I think we should ask the teacher for help.",
          "I think we should to ask the teacher for help.",
          "I think we asking the teacher for help.",
          "I think we asked the teacher for help."
        ],
        "answer": 0,
        "hints": [
          "힌트1 → I think we should 뒤에는 동사원형이 와.",
          "힌트2 → ask for help = 도움을 요청하다야.",
          "힌트3 → I think we should ask the teacher for help.가 맞아."
        ],
        "explanation": "should 뒤에는 동사원형! ②to ask는 should 뒤에 to 불필요, ③asking은 동명사 오답, ④asked는 과거형 오답이야."
      },
      {
        "type": "concept_check",
        "prompt": "문제가 생겼을 때 쓰는 표현 2가지와 해결책을 제안하는 표현 1가지를 써봐.",
        "answer": "We have a problem. / Something went wrong. / I think we should + 동사원형.",
        "hints": [
          "문제 상황: We have a problem. / Something went wrong.이야.",
          "해결책 제안: I think we should + 동사원형이야."
        ],
        "explanation": "문제 상황 표현: We have a problem.(문제가 생겼어), Something went wrong.(뭔가 잘못됐어). 해결책: I think we should fix it first.(먼저 고쳐야 할 것 같아)"
      },
      {
        "type": "short_answer",
        "prompt": "\"다른 방법을 시도해보는 게 어때?\"를 영어로 써봐.",
        "answer": "How about trying a different way?",
        "hints": [
          "힌트1 → How about + 동사ing 패턴을 써봐.",
          "힌트2 → try(시도하다)의 동명사는 trying이야.",
          "힌트3 → How about trying a different way?야."
        ],
        "explanation": "How about trying a different way? How about 뒤에는 동명사(ing)가 와. Why don't we try a different way?로도 말할 수 있어!"
      }
    ]
  }$json$::jsonb,
  ARRAY['학교', '협업', '축제'],
  true
),

-- =============================================
-- 중3(9학년) 사회 이슈 읽기와 의견 표현 easy 2개
-- =============================================
(
  '2b68c59c-e300-4c88-a4d9-755f484787ab',
  'ai', 'published', 'english',
  '환경 문제에 대한 내 의견 말하기',
  '영어 수업에서 기후변화에 관한 짧은 글을 읽고 의견을 발표해야 한다. 사회 이슈에 대해 영어로 의견을 표현하는 방법을 익혀보자.',
  'easy', 14,
  $json${
    "missionKey": "eng_mid3_social_easy_env_v1",
    "intro": {"text": "의견 말하기: In my opinion, ~ / I believe that ~ / I think ~ 근거 제시: because / since / This is because ~"},
    "activities": [
      {
        "type": "concept_check",
        "prompt": "의견을 말할 때 쓰는 표현 3가지를 써봐.",
        "answer": "In my opinion, ~ / I believe that ~ / I think ~",
        "hints": [
          "In my opinion = 내 생각에는이야.",
          "I believe that = 나는 ~라고 믿어(확신 표현)야.",
          "I think = 나는 ~라고 생각해야."
        ],
        "explanation": "의견 표현: In my opinion,(내 생각에는), I believe that(나는 ~라고 믿어), I think(나는 ~라고 생각해). 강도: I believe > I think 순이야."
      },
      {
        "type": "multiple_choice",
        "prompt": "\"내 생각에는 우리가 플라스틱 사용을 줄여야 해.\"를 영어로 하면?",
        "options": [
          "In my opinion, we should reduce plastic use.",
          "In my opinion, we should to reduce plastic use.",
          "In my opinion, we reducing plastic use.",
          "In my opinion, we reduced plastic use."
        ],
        "answer": 0,
        "hints": [
          "힌트1 → should 뒤에는 동사원형이 와.",
          "힌트2 → reduce(줄이다)의 동사원형을 써.",
          "힌트3 → In my opinion, we should reduce plastic use.야."
        ],
        "explanation": "In my opinion, we should reduce plastic use. should 뒤에는 반드시 동사원형! ②to reduce는 should 뒤에 to 불필요, ③reducing은 현재분사 오답이야."
      },
      {
        "type": "short_answer",
        "prompt": "\"나는 재활용이 중요하다고 생각해. 왜냐하면 환경을 보호하기 때문이야.\"를 영어로 써봐.",
        "answer": "I think recycling is important because it protects the environment.",
        "hints": [
          "힌트1 → I think + 주어 + 동사 패턴을 써봐.",
          "힌트2 → because 뒤에 이유를 써. it = recycling이야.",
          "힌트3 → I think recycling is important because it protects the environment.야."
        ],
        "explanation": "I think recycling is important because it protects the environment. because로 이유를 연결해. protect(보호하다)는 현재형으로 일반적 사실을 나타내!"
      }
    ]
  }$json$::jsonb,
  ARRAY['환경', '사회', '토론'],
  true
),
(
  '2b68c59c-e300-4c88-a4d9-755f484787ab',
  'ai', 'published', 'english',
  '짧은 뉴스 기사 읽고 요약하기',
  '영어 선생님이 학교 급식 관련 짧은 영어 기사를 나눠줬다. 모르는 단어가 있어도 전체 내용을 파악하는 방법을 배워보자.',
  'easy', 14,
  $json${
    "missionKey": "eng_mid3_social_easy_news_v1",
    "intro": {"text": "영어 기사 읽기 전략: 1) 제목으로 주제 파악 2) 첫 문장에서 핵심 정보 찾기 3) 모르는 단어는 앞뒤 문맥으로 추측하기"},
    "activities": [
      {
        "type": "concept_check",
        "prompt": "영어 글 읽기에서 핵심 정보(5W1H)는 무엇이야?",
        "answer": "Who(누가), What(무엇을), When(언제), Where(어디서), Why(왜), How(어떻게)",
        "hints": [
          "5W1H = Who, What, When, Where, Why, How야.",
          "뉴스 기사는 보통 첫 문장에 이 정보들이 담겨 있어."
        ],
        "explanation": "5W1H: Who(누가), What(무엇을), When(언제), Where(어디서), Why(왜), How(어떻게). 영어 기사의 첫 문단에서 이것들을 찾으면 전체 내용을 파악할 수 있어!"
      },
      {
        "type": "multiple_choice",
        "prompt": "다음 문장에서 주제를 고르면? \"Many schools are adding more vegetables to school lunches to improve student health.\"",
        "options": [
          "학교가 점심 메뉴에 채소를 늘리고 있다.",
          "학생들이 채소를 싫어한다.",
          "학교 점심값이 올랐다.",
          "학생 건강이 나빠지고 있다."
        ],
        "answer": 0,
        "hints": [
          "힌트1 → are adding more vegetables = 채소를 더 추가하고 있어.",
          "힌트2 → to improve student health = 학생 건강을 개선하기 위해서야.",
          "힌트3 → 학교가 학생 건강을 위해 채소를 늘리고 있다는 내용이야."
        ],
        "explanation": "Many schools(많은 학교들이) are adding more vegetables(채소를 더 추가하고 있어) to improve student health(학생 건강 개선을 위해). 주어+동사+목적어+이유 순으로 파악해!"
      },
      {
        "type": "short_answer",
        "prompt": "\"이 기사의 주제는 무엇입니까?\"를 영어로 쓰면?",
        "answer": "What is the main topic of this article?",
        "hints": [
          "힌트1 → 주제를 묻는 표현: What is the main topic~?이야.",
          "힌트2 → 기사 = article이야.",
          "힌트3 → What is the main topic of this article?야."
        ],
        "explanation": "What is the main topic of this article? topic(주제), article(기사)는 영어 수업에서 자주 쓰는 표현이야. main idea(핵심 내용)도 같이 기억해!"
      }
    ]
  }$json$::jsonb,
  ARRAY['뉴스', '사회', '읽기'],
  true
),

-- =============================================
-- 중3(9학년) 진로·사회 주제 읽기와 의견 표현 easy 2개
-- =============================================
(
  'cc40aad4-410c-46b5-91c1-41992b7ae89b',
  'ai', 'published', 'english',
  '장래 희망을 영어로 말하기',
  '영어 시간에 "What do you want to be in the future?"라는 질문을 받았다. 장래 희망과 이유를 영어로 말해보자.',
  'easy', 13,
  $json${
    "missionKey": "eng_mid3_career_easy_future_v1",
    "intro": {"text": "장래 희망 말하기: I want to be a(n) + 직업. 이유 말하기: because I want to + 동사 / because I like + 명사/동명사"},
    "activities": [
      {
        "type": "concept_check",
        "prompt": "\"나는 의사가 되고 싶어.\"를 영어로 써봐.",
        "answer": "I want to be a doctor.",
        "hints": [
          "want to be = ~가 되고 싶다이야.",
          "의사 = doctor, 관사 a를 잊지 마!",
          "I want to be a doctor.야."
        ],
        "explanation": "I want to be a doctor. want to be + 직업명으로 장래 희망을 말해. 모음으로 시작하는 직업(engineer, artist)앞에는 an을 써!"
      },
      {
        "type": "multiple_choice",
        "prompt": "\"나는 사람들을 돕고 싶어서 간호사가 되고 싶어.\"를 영어로 하면?",
        "options": [
          "I want to be a nurse because I want to help people.",
          "I want to be a nurse because I wanting to help people.",
          "I want to be a nurse because I helped people.",
          "I want to be a nurse because helping people."
        ],
        "answer": 0,
        "hints": [
          "힌트1 → because 뒤에 주어+동사가 와야 해.",
          "힌트2 → I want to help people = 나는 사람들을 돕고 싶어야.",
          "힌트3 → I want to be a nurse because I want to help people.야."
        ],
        "explanation": "because 뒤에는 주어+동사! ②wanting은 진행형 오답, ③helped는 과거형, ④because 뒤에 동명사만 오면 주어가 없어 오답이야."
      },
      {
        "type": "short_answer",
        "prompt": "네 장래 희망과 이유를 영어로 한 문장으로 써봐. (자유롭게)",
        "answer": "I want to be a [직업] because I [이유].",
        "hints": [
          "힌트1 → I want to be a(n) + 직업으로 시작해봐.",
          "힌트2 → because I want to + 동사 또는 because I like + 명사로 이유를 써봐.",
          "힌트3 → 예시: I want to be a teacher because I like helping others."
        ],
        "explanation": "예시: I want to be a game developer because I love creating things. 자신의 희망 직업과 이유를 자유롭게 써봐! 직업 단어: teacher, doctor, engineer, designer, chef 등"
      }
    ]
  }$json$::jsonb,
  ARRAY['진로', '미래', '직업'],
  true
),
(
  'cc40aad4-410c-46b5-91c1-41992b7ae89b',
  'ai', 'published', 'english',
  '직업 관련 영어 글 읽기',
  '영어 잡지에서 게임 개발자에 관한 짧은 글을 읽게 됐다. 직업 관련 글에서 핵심 정보를 파악하는 방법을 배워보자.',
  'easy', 13,
  $json${
    "missionKey": "eng_mid3_career_easy_reading_v1",
    "intro": {"text": "직업 관련 글 읽기 핵심: 직업명, 하는 일(duties), 필요한 능력(skills), 장점(advantages)을 찾아봐!"},
    "activities": [
      {
        "type": "multiple_choice",
        "prompt": "다음 문장의 뜻으로 맞는 것은? \"Game developers create and design video games for players around the world.\"",
        "options": [
          "게임 개발자들은 전 세계 플레이어들을 위한 비디오 게임을 만들고 설계한다.",
          "게임 개발자들은 전 세계를 여행하며 게임을 한다.",
          "게임 개발자들은 플레이어들에게 게임 방법을 가르친다.",
          "게임 개발자들은 게임 회사에서 일한다."
        ],
        "answer": 0,
        "hints": [
          "힌트1 → create and design = 만들고 설계하다야.",
          "힌트2 → video games for players = 플레이어들을 위한 비디오 게임이야.",
          "힌트3 → around the world = 전 세계야."
        ],
        "explanation": "create(만들다) + design(설계하다) + video games(비디오 게임) + for players around the world(전 세계 플레이어들을 위해). 동사와 목적어를 먼저 파악해!"
      },
      {
        "type": "concept_check",
        "prompt": "직업 관련 글에서 찾아야 할 핵심 정보 4가지는?",
        "answer": "직업명, 하는 일(duties), 필요한 능력(skills), 장점(advantages)",
        "hints": [
          "What is the job?(직업명)을 먼저 찾아봐.",
          "What do they do?(하는 일), What skills do they need?(능력), What are the benefits?(장점)도 찾아봐."
        ],
        "explanation": "직업 글 읽기 4요소: ①직업명 ②duties(하는 일) ③skills needed(필요 능력) ④advantages(장점). 이 4가지를 찾으면 글 전체를 이해할 수 있어!"
      },
      {
        "type": "short_answer",
        "prompt": "\"게임 개발자가 되려면 어떤 능력이 필요해?\"를 영어로 써봐.",
        "answer": "What skills do you need to become a game developer?",
        "hints": [
          "힌트1 → 능력을 묻는 표현: What skills~?이야.",
          "힌트2 → 되려면 = to become이야.",
          "힌트3 → What skills do you need to become a game developer?야."
        ],
        "explanation": "What skills do you need to become a game developer? skill(능력/기술), become(~이 되다)은 진로 관련 글에서 자주 나오는 표현이야!"
      }
    ]
  }$json$::jsonb,
  ARRAY['진로', '게임', '읽기'],
  true
),

-- =============================================
-- 중3(9학년) 사회 이슈 읽기와 발표 easy 2개
-- =============================================
(
  'd1c4ab66-3607-4ac8-9346-ef8b5140e775',
  'ai', 'published', 'english',
  '발표 시작과 마무리 표현 배우기',
  '영어 수업에서 환경 주제로 3분 발표를 해야 한다. 발표를 자연스럽게 시작하고 마무리하는 영어 표현을 익혀보자.',
  'easy', 13,
  $json${
    "missionKey": "eng_mid3_present_easy_intro_v1",
    "intro": {"text": "발표 시작: Good morning/afternoon, everyone. Today, I'm going to talk about~ 발표 마무리: That's all for my presentation. Thank you for listening!"},
    "activities": [
      {
        "type": "concept_check",
        "prompt": "발표 시작 표현을 완성해봐: \"Good morning, everyone. Today, I'm going to _____ about climate change.\"",
        "answer": "talk",
        "hints": [
          "I'm going to + 동사원형 패턴이야.",
          "발표에서 주제를 소개할 때 talk about을 써.",
          "I'm going to talk about~이야."
        ],
        "explanation": "I'm going to talk about climate change. talk about = ~에 대해 이야기하다. present, discuss, explain도 쓸 수 있어!"
      },
      {
        "type": "multiple_choice",
        "prompt": "발표를 마무리하는 표현으로 가장 자연스러운 것은?",
        "options": [
          "That's all for my presentation. Thank you for listening.",
          "I'm done. Bye.",
          "The end. Questions?",
          "I finished. Any question?"
        ],
        "answer": 0,
        "hints": [
          "힌트1 → 정중하고 격식 있는 표현을 골라봐.",
          "힌트2 → That's all for my presentation = 발표는 여기까지야.",
          "힌트3 → Thank you for listening = 들어주셔서 감사합니다야."
        ],
        "explanation": "That's all for my presentation. Thank you for listening.이 가장 자연스럽고 정중한 마무리야. ②③④는 너무 짧거나 비격식체야."
      },
      {
        "type": "short_answer",
        "prompt": "\"오늘 저는 재활용의 중요성에 대해 발표하겠습니다.\"를 영어로 써봐.",
        "answer": "Today, I'm going to talk about the importance of recycling.",
        "hints": [
          "힌트1 → Today, I'm going to talk about~으로 시작해봐.",
          "힌트2 → 중요성 = importance, 재활용 = recycling이야.",
          "힌트3 → Today, I'm going to talk about the importance of recycling.야."
        ],
        "explanation": "Today, I'm going to talk about the importance of recycling. importance of + 명사 = ~의 중요성. the importance of recycling(재활용의 중요성)을 기억해!"
      }
    ]
  }$json$::jsonb,
  ARRAY['발표', '환경', '학교'],
  true
),
(
  'd1c4ab66-3607-4ac8-9346-ef8b5140e775',
  'ai', 'published', 'english',
  '사회 이슈 글에서 주장과 근거 찾기',
  '영어 선생님이 스마트폰 사용에 관한 짧은 글을 주셨다. 글쓴이의 주장(claim)과 근거(evidence)를 찾는 방법을 배워보자.',
  'easy', 14,
  $json${
    "missionKey": "eng_mid3_present_easy_claim_v1",
    "intro": {"text": "주장(claim): 글쓴이가 말하고 싶은 핵심 의견. 근거(evidence): 주장을 뒷받침하는 사실이나 예시. 주장 찾기 신호어: should, must, important, necessary"},
    "activities": [
      {
        "type": "multiple_choice",
        "prompt": "다음 중 주장(claim)을 나타내는 문장은? \"Students should limit their smartphone use to 2 hours a day.\"",
        "options": [
          "이것은 주장이다. should가 의무/권고를 나타내기 때문이다.",
          "이것은 사실이다. 모든 학생이 그렇게 하기 때문이다.",
          "이것은 근거이다. 숫자가 포함되기 때문이다.",
          "이것은 질문이다. 답이 없기 때문이다."
        ],
        "answer": 0,
        "hints": [
          "힌트1 → should = ~해야 한다(의무/권고)야.",
          "힌트2 → 주장은 글쓴이의 의견이야. should, must, important가 신호어야.",
          "힌트3 → Students should limit~은 글쓴이의 의견(주장)이야."
        ],
        "explanation": "should는 주장의 신호어야. Students should limit their smartphone use = 학생들은 스마트폰 사용을 제한해야 한다. 이것은 사실이 아니라 글쓴이의 의견(주장)이야."
      },
      {
        "type": "concept_check",
        "prompt": "근거(evidence)를 나타내는 신호어를 3개 써봐.",
        "answer": "because, for example, according to (등)",
        "hints": [
          "이유를 나타낼 때: because, since, as를 써.",
          "예시를 들 때: for example, for instance를 써.",
          "출처를 인용할 때: according to를 써."
        ],
        "explanation": "근거 신호어: because(왜냐하면), for example(예를 들어), according to(~에 따르면), studies show that(연구에 따르면) 등이야. 이 단어 뒤에 근거가 나와!"
      },
      {
        "type": "short_answer",
        "prompt": "\"예를 들어, 너무 많은 스마트폰 사용은 수면 부족을 야기할 수 있어.\"를 영어로 써봐.",
        "answer": "For example, too much smartphone use can cause sleep problems.",
        "hints": [
          "힌트1 → 예를 들어 = For example로 시작해봐.",
          "힌트2 → 야기하다 = cause, 수면 부족 = sleep problems이야.",
          "힌트3 → For example, too much smartphone use can cause sleep problems.야."
        ],
        "explanation": "For example, too much smartphone use can cause sleep problems. cause(야기하다/원인이 되다)는 중요한 동사야. too much + 명사 = 너무 많은 ~이야!"
      }
    ]
  }$json$::jsonb,
  ARRAY['사회', '스마트폰', '읽기'],
  true
);
