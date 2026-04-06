# 수학 미션 6개 설계 초안 (DB 반영 전)

## 작업 범위
- 목적: 대표 6개 미션을 `generated_missions`에 넣기 좋은 형태로 정교화
- 원칙: 기존 `/student/math` 및 미션 상세 흐름 호환 우선
- 비범위: AI 자동 생성 로직 변경 없음

## 공통 반영 기준
- 확인된 컬럼 기준 메타: `subject`, `difficulty`, `estimated_minutes`, `reviewed_at`, `is_active`
- `curriculum_units` 참조 텍스트는 `title`이 아니라 `unit_name` 기준으로 설계
- `mission_templates` 분류 개념은 `template_key` 대신 `template_type` 기준으로 해석
- `mission_json` 키는 기존 파서 호환을 위해 유지:
  - `missionKey`, `title`, `scenario`, `essentialQuestion`, `conceptSummary`, `difficulty`, `estimatedMinutes`, `steps`
- 단계 기본 흐름: `concept -> input -> choice -> concept`
- 모바일 고려: 단계당 본문 1~2문장, 선택지는 최대 4개, 입력값은 단일 숫자/간단식 위주

---

## 1) 초4 나눗셈 - 피자 파티를 공평하게

### generated_missions 메타 초안
- title: 피자 파티를 공평하게
- subject: math
- difficulty: easy
- estimated_minutes: 10
- reviewed_at: null
- is_active: true

### mission_json 초안
```json
{
  "missionKey": "math-e4-division-pizza-fair-share-v1",
  "title": "피자 파티를 공평하게",
  "scenario": "피자 3판을 8명이 공평하게 나눠 먹으려 한다. 한 사람당 몇 판을 먹는지 계산해 보자.",
  "essentialQuestion": "전체를 사람 수로 나눌 때, 몫을 분수로 어떻게 표현할 수 있을까?",
  "conceptSummary": "나눗셈 결과가 1보다 작을 때도 분수로 정확히 표현하면 공평한 분배를 설명할 수 있다.",
  "difficulty": "easy",
  "estimatedMinutes": 10,
  "steps": [
    {
      "stepOrder": 1,
      "stepType": "concept",
      "title": "상황 이해",
      "question": "3판을 8명이 똑같이 나누면 1보다 작은 양이 나올 수 있어요.",
      "conceptDescription": "전체를 인원수로 나누는 식은 3 ÷ 8입니다."
    },
    {
      "stepOrder": 2,
      "stepType": "input",
      "title": "한 사람 몫 계산",
      "question": "3 ÷ 8을 분수로 쓰면?",
      "inputPlaceholder": "예: 3/8",
      "correctAnswer": "3/8",
      "hint": "a ÷ b = a/b"
    },
    {
      "stepOrder": 3,
      "stepType": "choice",
      "title": "양 비교",
      "question": "다음 중 3/8판과 같은 양은 무엇일까요?",
      "choices": ["피자 1판의 절반보다 적다", "피자 1판과 같다", "피자 1판보다 많다"],
      "correctAnswer": "피자 1판의 절반보다 적다",
      "hint": "1/2와 3/8을 비교해 보세요."
    },
    {
      "stepOrder": 4,
      "stepType": "concept",
      "title": "정리와 해석",
      "question": "왜 3/8판이 공평한 몫인지 말해 보세요.",
      "conceptDescription": "8명이 모두 같은 크기의 조각을 받으면 공평하며, 총합은 다시 3판이 됩니다."
    }
  ]
}
```

---

## 2) 초5 소수의 곱셈 - 할인 가격 계산소

### generated_missions 메타 초안
- title: 할인 가격 계산소
- subject: math
- difficulty: normal
- estimated_minutes: 12
- reviewed_at: null
- is_active: true

### mission_json 초안
```json
{
  "missionKey": "math-e5-decimal-mul-discount-v1",
  "title": "할인 가격 계산소",
  "scenario": "12,500원 상품을 0.8배 가격으로 할인 판매한다. 실제 결제 금액을 구해 보자.",
  "essentialQuestion": "소수 배를 곱하는 계산은 실제 할인 가격을 어떻게 설명할까?",
  "conceptSummary": "할인 후 가격은 원래 가격에 할인 배율(예: 0.8)을 곱해 계산할 수 있다.",
  "difficulty": "normal",
  "estimatedMinutes": 12,
  "steps": [
    {
      "stepOrder": 1,
      "stepType": "concept",
      "title": "할인 배율 이해",
      "question": "20% 할인은 가격의 0.8배를 뜻해요.",
      "conceptDescription": "100% - 20% = 80% = 0.8"
    },
    {
      "stepOrder": 2,
      "stepType": "input",
      "title": "결제 금액 계산",
      "question": "12,500 × 0.8 = ?",
      "inputPlaceholder": "숫자만 입력",
      "correctAnswer": "10000",
      "hint": "12500 × 8 ÷ 10으로 생각해 보세요."
    },
    {
      "stepOrder": 3,
      "stepType": "choice",
      "title": "계산 검증",
      "question": "정답을 빠르게 확인하는 방법으로 맞는 것은?",
      "choices": ["원가보다 더 큰지 본다", "원가의 80%인지 본다", "무조건 20원을 뺀다"],
      "correctAnswer": "원가의 80%인지 본다",
      "hint": "할인은 비율 변화입니다."
    },
    {
      "stepOrder": 4,
      "stepType": "concept",
      "title": "정리와 해석",
      "question": "할인율이 달라지면 어떤 배율을 곱해야 하는지 설명해 보세요.",
      "conceptDescription": "할인율 r%일 때 결제 금액은 원가 × (1-r/100)입니다."
    }
  ]
}
```

---

## 3) 초6 백분율 - 할인과 적립 중 뭐가 이득일까?

### generated_missions 메타 초안
- title: 할인과 적립 중 뭐가 이득일까?
- subject: math
- difficulty: normal
- estimated_minutes: 13
- reviewed_at: null
- is_active: true

### mission_json 초안
```json
{
  "missionKey": "math-e6-percent-discount-vs-point-v1",
  "title": "할인과 적립 중 뭐가 이득일까?",
  "scenario": "30,000원 구매 시 A안은 10% 즉시 할인, B안은 정가 결제 후 15% 포인트 적립이다.",
  "essentialQuestion": "같은 구매 상황에서 할인과 적립은 어떤 기준으로 비교해야 할까?",
  "conceptSummary": "즉시 할인은 지금 내는 돈, 적립은 다음에 쓸 수 있는 가치로 나눠 비교해야 한다.",
  "difficulty": "normal",
  "estimatedMinutes": 13,
  "steps": [
    {
      "stepOrder": 1,
      "stepType": "concept",
      "title": "비교 기준 세우기",
      "question": "할인은 즉시 절감, 적립은 미래 혜택입니다.",
      "conceptDescription": "같은 단위(원)로 환산해 비교하면 판단이 쉬워집니다."
    },
    {
      "stepOrder": 2,
      "stepType": "input",
      "title": "할인 금액 계산",
      "question": "30,000원의 10%는 얼마일까요?",
      "inputPlaceholder": "숫자만 입력",
      "correctAnswer": "3000",
      "hint": "30000 × 0.1"
    },
    {
      "stepOrder": 3,
      "stepType": "choice",
      "title": "상황 판단",
      "question": "지금 당장 결제액을 줄이고 싶다면 어떤 안이 더 직접적일까요?",
      "choices": ["A안(즉시 할인)", "B안(포인트 적립)", "둘 다 동일"],
      "correctAnswer": "A안(즉시 할인)",
      "hint": "질문은 '지금 결제액'에 초점이 있어요."
    },
    {
      "stepOrder": 4,
      "stepType": "concept",
      "title": "정리와 해석",
      "question": "너라면 어떤 안을 고를지 이유를 말해 보세요.",
      "conceptDescription": "사용 계획(재구매 여부)에 따라 유리한 선택이 달라질 수 있습니다."
    }
  ]
}
```

---

## 4) 중1 문자와 식 - 카페 세트 가격을 식으로 나타내기

### generated_missions 메타 초안
- title: 카페 세트 가격을 식으로 나타내기
- subject: math
- difficulty: easy
- estimated_minutes: 12
- reviewed_at: null
- is_active: true

### mission_json 초안
```json
{
  "missionKey": "math-m1-expression-cafe-set-v1",
  "title": "카페 세트 가격을 식으로 나타내기",
  "scenario": "기본 포장비 1,500원과 음료 1잔당 3,200원이 드는 세트 주문을 식으로 표현한다.",
  "essentialQuestion": "고정비와 개수에 따라 변하는 비용을 하나의 식으로 어떻게 나타낼까?",
  "conceptSummary": "문자 x를 개수로 두면 총비용은 '고정비 + 단가×x' 형태가 된다.",
  "difficulty": "easy",
  "estimatedMinutes": 12,
  "steps": [
    {
      "stepOrder": 1,
      "stepType": "concept",
      "title": "변수 정하기",
      "question": "x를 음료 잔 수라고 정하면 식을 세울 수 있어요.",
      "conceptDescription": "고정비 1500은 x와 무관한 상수입니다."
    },
    {
      "stepOrder": 2,
      "stepType": "input",
      "title": "식 완성",
      "question": "총비용 y를 x에 대한 식으로 쓰세요. (예: 3x+2)",
      "inputPlaceholder": "예: 3200x+1500",
      "correctAnswer": "y=3200x+1500",
      "hint": "단가×개수 + 고정비"
    },
    {
      "stepOrder": 3,
      "stepType": "choice",
      "title": "값 해석",
      "question": "x=4일 때 총비용으로 맞는 것은?",
      "choices": ["11,300원", "12,800원", "14,300원"],
      "correctAnswer": "14,300원",
      "hint": "3200×4 + 1500"
    },
    {
      "stepOrder": 4,
      "stepType": "concept",
      "title": "정리와 해석",
      "question": "식에서 1,500과 3,200의 의미를 말해 보세요.",
      "conceptDescription": "상수항은 고정비, 문자 앞 계수는 1개 늘 때 증가량입니다."
    }
  ]
}
```

---

## 5) 중2 연립방정식 - 반티 주문 최적화

### generated_missions 메타 초안
- title: 반티 주문 최적화
- subject: math
- difficulty: challenge
- estimated_minutes: 15
- reviewed_at: null
- is_active: true

### mission_json 초안
```json
{
  "missionKey": "math-m2-system-class-tshirt-v1",
  "title": "반티 주문 최적화",
  "scenario": "반티를 긴팔(x장), 반팔(y장)로 주문했더니 총 28장, 총액 322,000원이 나왔다.",
  "essentialQuestion": "두 미지수가 있는 상황에서 식 두 개로 해를 어떻게 찾을까?",
  "conceptSummary": "연립방정식은 '개수 조건'과 '금액 조건'을 동시에 만족하는 값을 찾는 도구다.",
  "difficulty": "challenge",
  "estimatedMinutes": 15,
  "steps": [
    {
      "stepOrder": 1,
      "stepType": "concept",
      "title": "식 세우기",
      "question": "긴팔 13,000원, 반팔 10,000원일 때 식을 세워 보세요.",
      "conceptDescription": "x+y=28, 13000x+10000y=322000"
    },
    {
      "stepOrder": 2,
      "stepType": "input",
      "title": "한 변수 소거",
      "question": "x+y=28에서 y를 x로 나타내면?",
      "inputPlaceholder": "예: y=28-x",
      "correctAnswer": "y=28-x",
      "hint": "양변에서 x를 빼세요."
    },
    {
      "stepOrder": 3,
      "stepType": "choice",
      "title": "해 선택",
      "question": "(x,y)로 맞는 조합은?",
      "choices": ["(14,14)", "(12,16)", "(10,18)"],
      "correctAnswer": "(14,14)",
      "hint": "둘 다 식에 대입해 확인하세요."
    },
    {
      "stepOrder": 4,
      "stepType": "concept",
      "title": "정리와 해석",
      "question": "왜 두 식을 동시에 만족해야만 실제 주문 수량이 될까요?",
      "conceptDescription": "한 식만 맞으면 개수 또는 금액 조건 하나가 어긋날 수 있습니다."
    }
  ]
}
```

---

## 6) 중3 이차함수 - 농구 슛 궤적 분석

### generated_missions 메타 초안
- title: 농구 슛 궤적 분석
- subject: math
- difficulty: challenge
- estimated_minutes: 15
- reviewed_at: null
- is_active: true

### mission_json 초안
```json
{
  "missionKey": "math-m3-quadratic-basket-trajectory-v1",
  "title": "농구 슛 궤적 분석",
  "scenario": "공의 높이 h(x)= -0.2x^2 + 1.2x + 2 (m)로 주어졌을 때 궤적을 해석한다.",
  "essentialQuestion": "이차함수의 그래프 정보로 최고점과 성공 가능성을 어떻게 판단할까?",
  "conceptSummary": "이차함수에서 계수 부호는 그래프 모양을, 꼭짓점은 최대/최소 높이를 알려 준다.",
  "difficulty": "challenge",
  "estimatedMinutes": 15,
  "steps": [
    {
      "stepOrder": 1,
      "stepType": "concept",
      "title": "그래프 모양 파악",
      "question": "x^2의 계수가 음수이므로 아래로 열린 포물선입니다.",
      "conceptDescription": "공은 올라갔다가 내려오는 궤적을 가집니다."
    },
    {
      "stepOrder": 2,
      "stepType": "input",
      "title": "꼭짓점 x좌표",
      "question": "h(x)=ax^2+bx+c에서 꼭짓점 x좌표 -b/(2a)를 적용하면?",
      "inputPlaceholder": "숫자만 입력",
      "correctAnswer": "3",
      "hint": "a=-0.2, b=1.2"
    },
    {
      "stepOrder": 3,
      "stepType": "choice",
      "title": "상황 해석",
      "question": "최고 높이를 판단하는 설명으로 맞는 것은?",
      "choices": ["x=0에서 최고", "x=3에서 최고", "항상 같은 높이"],
      "correctAnswer": "x=3에서 최고",
      "hint": "아래로 열린 포물선의 꼭짓점이 최대값입니다."
    },
    {
      "stepOrder": 4,
      "stepType": "concept",
      "title": "정리와 해석",
      "question": "림 높이(예: 3.05m)와 비교해 슛 성공 조건을 설명해 보세요.",
      "conceptDescription": "함수값을 특정 x에서 계산해 실제 상황 판단으로 연결할 수 있습니다."
    }
  ]
}
```

---

## 다음 반영 준비 메모
- DB insert 전 확인 항목
- `unit_id`는 해당 학년/단원의 `curriculum_units.unit_name` 맥락과 맞는 실제 id 매핑 필요
- `status`는 학생 노출 전까지 `draft` 또는 `review`로 시작 권장
- `mission_json.steps`는 현재 파서/화면 호환을 위해 `stepOrder` 오름차순 유지
- 선택형(`choice`)의 `correctAnswer`는 `choices` 값과 완전히 동일한 문자열로 저장
