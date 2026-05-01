export type MissionStepKind = "concept" | "input" | "choice";

type StepSpec = {
  step_order: number;
  type: MissionStepKind;
  title: string;
  prompt?: string;
  answer_type?: "number" | "text" | "equation";
  choices?: string[];
  correct_answer?: string;
  hint?: string;
  explanation: string;
};

export type PreparedMissionJson = {
  version: string;
  mission_type: string;
  learning_goal: string;
  real_life_context: string;
  missionKey: string;
  title: string;
  scenario: string;
  essentialQuestion: string;
  conceptSummary: string;
  difficulty: "easy" | "normal" | "challenge";
  estimatedMinutes: number;
  steps: Array<
    StepSpec & {
      stepOrder: number;
      stepType: "intro" | "concept" | "input" | "choice";
      question?: string;
      inputPlaceholder?: string;
      correctAnswer?: string;
      conceptDescription?: string;
      conceptTitle?: string;
    }
  >;
};

export type PreparedMissionAsset = {
  slug: string;
  title: string;
  subject: "math";
  difficulty: "easy" | "normal" | "challenge";
  estimated_minutes: number;
  unit_lookup: {
    school_level: "elementary" | "middle";
    grade: number;
    unit_name: string;
  };
  mission_json: PreparedMissionJson;
};

function toCompatSteps(steps: StepSpec[]): PreparedMissionJson["steps"] {
  return steps.map((step) => ({
    ...step,
    stepOrder: step.step_order,
    stepType: step.type,
    question: step.prompt,
    inputPlaceholder: step.type === "input" ? "정답을 입력하세요" : undefined,
    correctAnswer: step.correct_answer,
    conceptTitle: step.type === "concept" ? step.title : undefined,
    conceptDescription: step.explanation,
  }));
}

function buildMissionJson(input: {
  missionKey: string;
  title: string;
  scenario: string;
  essentialQuestion: string;
  conceptSummary: string;
  learning_goal: string;
  real_life_context: string;
  mission_type: string;
  difficulty: "easy" | "normal" | "challenge";
  estimatedMinutes: number;
  steps: StepSpec[];
}): PreparedMissionJson {
  return {
    version: "1.0.0",
    mission_type: input.mission_type,
    learning_goal: input.learning_goal,
    real_life_context: input.real_life_context,
    missionKey: input.missionKey,
    title: input.title,
    scenario: input.scenario,
    essentialQuestion: input.essentialQuestion,
    conceptSummary: input.conceptSummary,
    difficulty: input.difficulty,
    estimatedMinutes: input.estimatedMinutes,
    steps: toCompatSteps(input.steps),
  };
}

export const QUALITY_MISSIONS_6: PreparedMissionAsset[] = [
  {
    slug: "elem4-division-pizza-fair-share",
    title: "피자 파티를 공평하게",
    subject: "math",
    difficulty: "easy",
    estimated_minutes: 10,
    unit_lookup: {
      school_level: "elementary",
      grade: 4,
      unit_name: "나눗셈",
    },
    mission_json: buildMissionJson({
      missionKey: "math-e4-division-pizza-fair-share-v1",
      title: "피자 파티를 공평하게",
      scenario: "피자 3판을 8명이 공평하게 나누려 한다. 한 사람당 얼마를 먹는지 분수로 표현해 보자.",
      essentialQuestion: "나눗셈 결과를 분수로 나타내면 공평한 분배를 어떻게 설명할 수 있을까?",
      conceptSummary: "전체를 인원수로 나눈 값을 분수로 표현하면 1보다 작은 몫도 정확히 설명할 수 있다.",
      learning_goal: "나눗셈 결과를 분수로 나타내고, 분수 크기를 해석한다.",
      real_life_context: "파티 음식 공평 분배",
      mission_type: "real_life_problem_solving",
      difficulty: "easy",
      estimatedMinutes: 10,
      steps: [
        {
          step_order: 1,
          type: "concept",
          title: "상황 이해",
          prompt: "3판을 8명에게 똑같이 나누면 한 사람 몫은 1판보다 작을 수 있어요.",
          explanation: "전체를 사람 수로 나누는 식은 3 ÷ 8입니다.",
        },
        {
          step_order: 2,
          type: "input",
          title: "몫을 분수로 쓰기",
          prompt: "3 ÷ 8을 분수로 쓰면?",
          answer_type: "equation",
          correct_answer: "3/8",
          hint: "a ÷ b = a/b",
          explanation: "나눗셈을 분수로 바꾸면 몫을 정확히 표현할 수 있어요.",
        },
        {
          step_order: 3,
          type: "choice",
          title: "크기 비교",
          prompt: "3/8의 크기를 가장 잘 설명한 것은?",
          choices: ["1/2보다 작다", "1/2와 같다", "1/2보다 크다"],
          correct_answer: "1/2보다 작다",
          hint: "3/8과 4/8을 비교해 보세요.",
          explanation: "분모가 같을 때 분자가 작으면 전체 크기도 작아요.",
        },
        {
          step_order: 4,
          type: "concept",
          title: "개념 정리",
          prompt: "왜 3/8판이 공평한 몫인지 설명해 보세요.",
          explanation: "8명이 같은 양을 받고 모두 합치면 다시 3판이 되어야 공평합니다.",
        },
      ],
    }),
  },
  {
    slug: "elem5-decimal-mul-discount-counter",
    title: "할인 가격 계산소",
    subject: "math",
    difficulty: "normal",
    estimated_minutes: 12,
    unit_lookup: {
      school_level: "elementary",
      grade: 5,
      unit_name: "소수",
    },
    mission_json: buildMissionJson({
      missionKey: "math-e5-decimal-mul-discount-counter-v1",
      title: "할인 가격 계산소",
      scenario: "12,500원 상품을 20% 할인해서 판매한다. 실제 결제 금액을 구해 보자.",
      essentialQuestion: "할인 상황에서 소수의 곱셈은 실제 결제 금액을 어떻게 설명할까?",
      conceptSummary: "20% 할인은 원래 가격의 0.8배를 뜻하며, 원가에 소수를 곱해 할인 가격을 구한다.",
      learning_goal: "소수 배 계산으로 할인 금액과 결제 금액을 구한다.",
      real_life_context: "온라인 쇼핑 할인 계산",
      mission_type: "real_life_problem_solving",
      difficulty: "normal",
      estimatedMinutes: 12,
      steps: [
        {
          step_order: 1,
          type: "concept",
          title: "할인 배율 이해",
          prompt: "20% 할인은 가격의 80%, 즉 0.8배를 뜻합니다.",
          explanation: "100% - 20% = 80% = 0.8",
        },
        {
          step_order: 2,
          type: "input",
          title: "결제 금액 계산",
          prompt: "12,500 × 0.8 = ?",
          answer_type: "number",
          correct_answer: "10000",
          hint: "12500 × 8 ÷ 10으로 계산해 보세요.",
          explanation: "소수 곱셈은 정수 계산 후 자리값을 반영합니다.",
        },
        {
          step_order: 3,
          type: "choice",
          title: "검산 방법 선택",
          prompt: "결과가 맞는지 빠르게 확인하는 방법은?",
          choices: ["원가의 80%인지 확인", "원가보다 큰지 확인", "무조건 2,000원 빼기"],
          correct_answer: "원가의 80%인지 확인",
          hint: "할인은 비율 변화예요.",
          explanation: "할인율 문제는 비율로 검산하는 습관이 중요합니다.",
        },
        {
          step_order: 4,
          type: "concept",
          title: "개념 정리",
          prompt: "할인율이 바뀌면 어떤 수를 곱해야 하는지 정리해 보세요.",
          explanation: "할인율 r%일 때 결제 금액은 원가 × (1-r/100)입니다.",
        },
      ],
    }),
  },
  {
    slug: "elem6-percent-discount-vs-point",
    title: "할인과 적립 중 뭐가 이득일까?",
    subject: "math",
    difficulty: "normal",
    estimated_minutes: 13,
    unit_lookup: {
      school_level: "elementary",
      grade: 6,
      unit_name: "비례",
    },
    mission_json: buildMissionJson({
      missionKey: "math-e6-percent-discount-vs-point-v1",
      title: "할인과 적립 중 뭐가 이득일까?",
      scenario: "30,000원 구매 시 A는 10% 즉시 할인, B는 15% 포인트 적립이다.",
      essentialQuestion: "할인과 적립을 비교할 때 어떤 기준으로 판단해야 할까?",
      conceptSummary: "즉시 할인은 지금 지출, 적립은 미래 혜택이므로 같은 단위로 바꿔 비교해야 한다.",
      learning_goal: "백분율을 금액으로 바꾸어 선택 상황을 해석한다.",
      real_life_context: "멤버십 혜택 선택",
      mission_type: "real_life_decision",
      difficulty: "normal",
      estimatedMinutes: 13,
      steps: [
        {
          step_order: 1,
          type: "concept",
          title: "비교 관점 정하기",
          prompt: "할인은 지금 절약, 적립은 다음 구매 혜택입니다.",
          explanation: "같은 기준(원)으로 환산해 비교해야 공정합니다.",
        },
        {
          step_order: 2,
          type: "input",
          title: "즉시 할인 계산",
          prompt: "30,000원의 10%는 얼마인가요?",
          answer_type: "number",
          correct_answer: "3000",
          hint: "30000 × 0.1",
          explanation: "백분율은 소수로 바꿔 곱합니다.",
        },
        {
          step_order: 3,
          type: "choice",
          title: "상황 기반 선택",
          prompt: "지금 결제액을 줄이고 싶다면 더 직접적인 선택은?",
          choices: ["A안(즉시 할인)", "B안(포인트 적립)", "둘 다 같다"],
          correct_answer: "A안(즉시 할인)",
          hint: "질문의 초점은 '지금 결제액'입니다.",
          explanation: "목표가 다르면 유리한 선택도 달라집니다.",
        },
        {
          step_order: 4,
          type: "concept",
          title: "개념 정리",
          prompt: "다음 구매 계획이 있을 때 선택이 왜 달라질 수 있는지 설명해 보세요.",
          explanation: "재구매가 확실하면 적립도 실질 절약으로 볼 수 있습니다.",
        },
      ],
    }),
  },
  {
    slug: "middle1-expression-cafe-set",
    title: "카페 세트 가격을 식으로 나타내기",
    subject: "math",
    difficulty: "easy",
    estimated_minutes: 12,
    unit_lookup: {
      school_level: "middle",
      grade: 1,
      unit_name: "문자와 식",
    },
    mission_json: buildMissionJson({
      missionKey: "math-m1-expression-cafe-set-v1",
      title: "카페 세트 가격을 식으로 나타내기",
      scenario: "기본 포장비 1,500원과 음료 1잔당 3,200원이 드는 주문의 총금액을 식으로 만든다.",
      essentialQuestion: "고정비와 변동비를 어떻게 하나의 식으로 표현할 수 있을까?",
      conceptSummary: "총금액은 고정비 + (단가 × 개수) 형태로 표현된다.",
      learning_goal: "문자와 식으로 실생활 비용 구조를 모델링한다.",
      real_life_context: "카페 세트 주문",
      mission_type: "modeling_expression",
      difficulty: "easy",
      estimatedMinutes: 12,
      steps: [
        {
          step_order: 1,
          type: "concept",
          title: "변수 정의",
          prompt: "x를 음료 잔 수로 두고 y를 총금액으로 둡니다.",
          explanation: "문자를 쓰면 여러 상황을 한 식으로 나타낼 수 있습니다.",
        },
        {
          step_order: 2,
          type: "input",
          title: "식 만들기",
          prompt: "총금액 y를 x에 대한 식으로 쓰세요.",
          answer_type: "equation",
          correct_answer: "y=3200x+1500",
          hint: "단가×개수 + 고정비",
          explanation: "고정비는 상수항, 단가는 x의 계수로 나타납니다.",
        },
        {
          step_order: 3,
          type: "choice",
          title: "값 대입 해석",
          prompt: "x=4일 때 총금액은?",
          choices: ["11,300원", "12,800원", "14,300원"],
          correct_answer: "14,300원",
          hint: "3200×4 + 1500",
          explanation: "식은 상황별 값을 빠르게 계산하게 해 줍니다.",
        },
        {
          step_order: 4,
          type: "concept",
          title: "개념 정리",
          prompt: "식에서 1500과 3200의 의미를 각각 말해 보세요.",
          explanation: "1500은 고정비, 3200은 1잔 추가될 때 증가하는 금액입니다.",
        },
      ],
    }),
  },
  {
    slug: "middle2-system-uniform-order",
    title: "반티 주문 최적화",
    subject: "math",
    difficulty: "challenge",
    estimated_minutes: 15,
    unit_lookup: {
      school_level: "middle",
      grade: 2,
      unit_name: "연립방정식",
    },
    mission_json: buildMissionJson({
      missionKey: "math-m2-system-uniform-order-v1",
      title: "반티 주문 최적화",
      scenario: "긴팔(x장)과 반팔(y장)을 합쳐 28장 주문했고 총액은 322,000원이다.",
      essentialQuestion: "두 미지수가 있는 상황에서 식 두 개로 해를 어떻게 찾을까?",
      conceptSummary: "연립방정식은 개수 조건과 금액 조건을 동시에 만족하는 값을 찾는 방법이다.",
      learning_goal: "실생활 조건을 연립일차방정식으로 모델링하고 해를 해석한다.",
      real_life_context: "학급 단체복 예산 계획",
      mission_type: "system_equation_modeling",
      difficulty: "challenge",
      estimatedMinutes: 15,
      steps: [
        {
          step_order: 1,
          type: "concept",
          title: "식 세우기",
          prompt: "긴팔 13,000원, 반팔 10,000원일 때 조건을 식으로 써 봅니다.",
          explanation: "x+y=28, 13000x+10000y=322000",
        },
        {
          step_order: 2,
          type: "input",
          title: "대입 준비",
          prompt: "x+y=28에서 y를 x로 나타내면?",
          answer_type: "equation",
          correct_answer: "y=28-x",
          hint: "양변에서 x를 빼세요.",
          explanation: "한 식을 다른 식에 대입하기 위해 정리합니다.",
        },
        {
          step_order: 3,
          type: "choice",
          title: "해 검증",
          prompt: "조건을 모두 만족하는 (x,y)는?",
          choices: ["(14,14)", "(12,16)", "(10,18)"],
          correct_answer: "(14,14)",
          hint: "두 식에 각각 대입해서 확인하세요.",
          explanation: "연립방정식의 해는 두 식을 동시에 만족해야 합니다.",
        },
        {
          step_order: 4,
          type: "concept",
          title: "개념 정리",
          prompt: "왜 한 식만 맞는 값은 실제 주문 해가 될 수 없는지 설명해 보세요.",
          explanation: "개수와 금액 조건 중 하나라도 틀리면 실제 상황과 맞지 않습니다.",
        },
      ],
    }),
  },
  {
    slug: "middle3-quadratic-basket-shot",
    title: "농구 슛 궤적 분석",
    subject: "math",
    difficulty: "challenge",
    estimated_minutes: 15,
    unit_lookup: {
      school_level: "middle",
      grade: 3,
      unit_name: "이차함수",
    },
    mission_json: buildMissionJson({
      missionKey: "math-m3-quadratic-basket-shot-v1",
      title: "농구 슛 궤적 분석",
      scenario: "공의 높이 h(x)= -0.2x^2 + 1.2x + 2 (m)로 주어졌을 때 궤적을 해석한다.",
      essentialQuestion: "이차함수의 형태와 꼭짓점으로 최고 높이와 성공 가능성을 어떻게 판단할까?",
      conceptSummary: "이차항 계수의 부호는 그래프 모양을, 꼭짓점은 최대 높이를 알려 준다.",
      learning_goal: "함수식을 그래프 의미와 실생활 해석으로 연결한다.",
      real_life_context: "농구 슛 성공 분석",
      mission_type: "quadratic_interpretation",
      difficulty: "challenge",
      estimatedMinutes: 15,
      steps: [
        {
          step_order: 1,
          type: "concept",
          title: "그래프 형태 파악",
          prompt: "x^2 계수가 음수이므로 아래로 열린 포물선입니다.",
          explanation: "공은 올라갔다가 내려오는 경로를 가집니다.",
        },
        {
          step_order: 2,
          type: "input",
          title: "꼭짓점 x좌표 계산",
          prompt: "-b/(2a)를 이용해 꼭짓점 x좌표를 구하세요.",
          answer_type: "number",
          correct_answer: "3",
          hint: "a=-0.2, b=1.2",
          explanation: "꼭짓점 x좌표는 최대/최소가 되는 위치입니다.",
        },
        {
          step_order: 3,
          type: "choice",
          title: "의미 해석",
          prompt: "최고 높이에 대한 설명으로 맞는 것은?",
          choices: ["x=0에서 최고", "x=3에서 최고", "항상 같은 높이"],
          correct_answer: "x=3에서 최고",
          hint: "아래로 열린 포물선의 꼭짓점을 떠올려 보세요.",
          explanation: "꼭짓점은 이 함수의 최대값 위치입니다.",
        },
        {
          step_order: 4,
          type: "concept",
          title: "개념 정리",
          prompt: "림 높이 3.05m와 비교해 성공 가능성을 설명해 보세요.",
          explanation: "특정 위치의 함수값을 계산하면 실제 성공 가능성을 추론할 수 있습니다.",
        },
      ],
    }),
  },
];
