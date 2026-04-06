export type MathMission = {
  id: string;
  schoolLevel: "middle" | "high";
  grade: 1 | 2 | 3;
  unitKey: string;
  unitTitle: string;
  missionTitle: string;
  scenario: string;
  essentialQuestion: string;
  mathModel: string;
  strategyHint: string;
  conceptSummary: string;
  difficulty: "easy" | "normal" | "challenge";
  estimatedMinutes: number;
  tags: string[];
};

export type MathGradeKey = "middle-1" | "middle-2" | "middle-3" | "high";

export const MATH_MISSIONS: MathMission[] = [
  {
    id: "m1-score-reversal",
    schoolLevel: "middle",
    grade: 1,
    unitKey: "integer-rational",
    unitTitle: "정수와 유리수",
    missionTitle: "게임 점수 반전 작전",
    scenario: "승리 시 +점수, 패배 시 -점수가 반영되는 경기 기록을 빠르게 정리해야 합니다.",
    essentialQuestion: "연속 경기 결과를 어떻게 한 번에 계산할 수 있을까?",
    mathModel: "점수 변화를 +와 - 정수로 보고 누적합으로 모델링합니다.",
    strategyHint: "양수와 음수를 묶어서 계산 순서를 단순화해 보세요.",
    conceptSummary: "정수의 덧셈과 뺄셈, 부호 해석",
    difficulty: "easy",
    estimatedMinutes: 4,
    tags: ["게임", "점수", "정수"],
  },
  {
    id: "m1-store-discount",
    schoolLevel: "middle",
    grade: 1,
    unitKey: "expression",
    unitTitle: "문자와 식",
    missionTitle: "편의점 할인식 만들기",
    scenario: "음료를 여러 개 살 때 개수에 따라 할인 방식이 달라집니다.",
    essentialQuestion: "개수가 바뀌어도 가격을 한 번에 나타낼 수 있을까?",
    mathModel: "개수를 문자로 두고 총가격 식을 세워 경우를 비교합니다.",
    strategyHint: "기본 가격, 할인 금액, 개수를 분리해 식으로 표현해 보세요.",
    conceptSummary: "문자 사용, 식 세우기, 식의 값",
    difficulty: "easy",
    estimatedMinutes: 5,
    tags: ["소비", "할인", "식"],
  },
  {
    id: "m1-budget-plan",
    schoolLevel: "middle",
    grade: 1,
    unitKey: "linear-equation",
    unitTitle: "일차방정식",
    missionTitle: "용돈 분배 계획 세우기",
    scenario: "교통비와 간식비를 조절해 정해진 예산 안에서 일주일을 보내야 합니다.",
    essentialQuestion: "예산 안에서 가장 합리적인 선택은 무엇일까?",
    mathModel: "총지출을 미지수 1개인 방정식으로 모델링합니다.",
    strategyHint: "고정지출과 변동지출을 먼저 나누면 식이 단순해집니다.",
    conceptSummary: "일차방정식의 해와 해석",
    difficulty: "normal",
    estimatedMinutes: 5,
    tags: ["예산", "생활", "방정식"],
  },
  {
    id: "m2-trip-settlement",
    schoolLevel: "middle",
    grade: 2,
    unitKey: "system-equation",
    unitTitle: "연립방정식",
    missionTitle: "친구와 여행비 정산하기",
    scenario: "교통비와 식비를 서로 나눠 냈고 최종 정산 금액을 계산해야 합니다.",
    essentialQuestion: "두 비용 관계를 함께 보면 정산이 어떻게 쉬워질까?",
    mathModel: "미지수 2개를 두고 식 2개를 세워 해를 찾습니다.",
    strategyHint: "합계 식과 차이 식을 먼저 세우고 가감법을 써 보세요.",
    conceptSummary: "두 미지수 관계 해석과 연립방정식 풀이",
    difficulty: "normal",
    estimatedMinutes: 5,
    tags: ["여행", "정산", "연립방정식"],
  },
  {
    id: "m2-taxi-graph",
    schoolLevel: "middle",
    grade: 2,
    unitKey: "linear-function",
    unitTitle: "일차함수",
    missionTitle: "택시요금 그래프 읽기",
    scenario: "기본요금과 거리요금이 있는 택시요금표를 그래프로 비교합니다.",
    essentialQuestion: "거리 변화에 따라 요금은 얼마나 빠르게 늘어날까?",
    mathModel: "요금을 y, 거리를 x로 두어 일차함수로 표현합니다.",
    strategyHint: "절편은 기본요금, 기울기는 거리당 요금으로 해석하세요.",
    conceptSummary: "변화율, 그래프, 기울기 해석",
    difficulty: "normal",
    estimatedMinutes: 4,
    tags: ["이동", "그래프", "함수"],
  },
  {
    id: "m2-probability-item",
    schoolLevel: "middle",
    grade: 2,
    unitKey: "probability",
    unitTitle: "확률",
    missionTitle: "게임 아이템 뽑기 확률 따져보기",
    scenario: "희귀 아이템을 얻기 위한 뽑기 횟수와 확률을 비교해야 합니다.",
    essentialQuestion: "같은 비용이라면 어떤 뽑기 방식이 더 유리할까?",
    mathModel: "경우의 수와 사건 확률로 선택지를 수치화합니다.",
    strategyHint: "표본공간을 먼저 정리하고 상대도수를 비교해 보세요.",
    conceptSummary: "경우의 수, 확률 계산, 기대 판단",
    difficulty: "normal",
    estimatedMinutes: 5,
    tags: ["게임", "확률", "선택"],
  },
  {
    id: "m3-sneaker-timing",
    schoolLevel: "middle",
    grade: 3,
    unitKey: "quadratic-equation",
    unitTitle: "이차방정식",
    missionTitle: "한정판 운동화 가격 예측",
    scenario: "시간에 따라 가격이 변하는 데이터를 보고 구매 시점을 판단합니다.",
    essentialQuestion: "언제 사는 것이 가장 합리적일까?",
    mathModel: "가격 조건을 식으로 세우고 이차방정식의 해를 해석합니다.",
    strategyHint: "조건을 만족하는 시점을 해로 보고 의미를 비교해 보세요.",
    conceptSummary: "이차방정식 해석과 최적 시점 판단",
    difficulty: "challenge",
    estimatedMinutes: 5,
    tags: ["소비", "예측", "이차방정식"],
  },
  {
    id: "m3-shot-trajectory",
    schoolLevel: "middle",
    grade: 3,
    unitKey: "quadratic-function",
    unitTitle: "이차함수",
    missionTitle: "농구 슛 궤적 분석",
    scenario: "공의 이동 경로를 보고 최고점과 골대 도달 가능성을 판단합니다.",
    essentialQuestion: "슛의 최고점과 도달 지점을 어떻게 읽을 수 있을까?",
    mathModel: "포물선 그래프로 높이 변화를 모델링합니다.",
    strategyHint: "꼭짓점의 의미를 먼저 정리하면 해석이 쉬워집니다.",
    conceptSummary: "포물선 그래프, 꼭짓점, 축",
    difficulty: "normal",
    estimatedMinutes: 4,
    tags: ["스포츠", "그래프", "이차함수"],
  },
  {
    id: "m3-building-height",
    schoolLevel: "middle",
    grade: 3,
    unitKey: "trigonometric-ratio",
    unitTitle: "삼각비",
    missionTitle: "건물 높이 재기 프로젝트",
    scenario: "직접 올라가지 않고 그림자 길이와 각도로 건물 높이를 추정합니다.",
    essentialQuestion: "측정값을 이용해 높이를 정확히 구할 수 있을까?",
    mathModel: "직각삼각형과 삼각비 관계로 높이를 식으로 표현합니다.",
    strategyHint: "알고 있는 변과 각을 기준으로 적절한 삼각비를 고르세요.",
    conceptSummary: "삼각비와 실생활 측정",
    difficulty: "challenge",
    estimatedMinutes: 5,
    tags: ["측정", "건축", "삼각비"],
  },
  {
    id: "h-sequence-growth",
    schoolLevel: "high",
    grade: 1,
    unitKey: "sequence",
    unitTitle: "수열",
    missionTitle: "유튜브 구독자 성장 예측",
    scenario: "주간 구독자 데이터를 기반으로 다음 달 추이를 예측합니다.",
    essentialQuestion: "증가 패턴을 수식으로 만들면 어떤 판단이 가능할까?",
    mathModel: "등차/등비 패턴을 비교해 수열 모델을 세웁니다.",
    strategyHint: "연속 항의 차이 또는 비를 먼저 점검해 보세요.",
    conceptSummary: "수열의 규칙성과 일반항 해석",
    difficulty: "normal",
    estimatedMinutes: 4,
    tags: ["콘텐츠", "성장", "수열"],
  },
  {
    id: "h-rate-speed-distance",
    schoolLevel: "high",
    grade: 2,
    unitKey: "rate-of-change",
    unitTitle: "변화율",
    missionTitle: "자동차 속도와 거리 분석",
    scenario: "시간별 속도 기록을 보고 주행 거리와 위험 구간을 분석합니다.",
    essentialQuestion: "속도 변화 데이터로 주행 상태를 어떻게 판단할까?",
    mathModel: "평균변화율과 순간변화율 관점으로 구간을 해석합니다.",
    strategyHint: "구간별 변화량을 먼저 비교하고 그래프 의미를 읽어 보세요.",
    conceptSummary: "변화율 해석과 그래프 기반 판단",
    difficulty: "challenge",
    estimatedMinutes: 5,
    tags: ["이동", "데이터", "변화율"],
  },
  {
    id: "h-risk-return",
    schoolLevel: "high",
    grade: 3,
    unitKey: "probability-statistics",
    unitTitle: "확률과 통계",
    missionTitle: "투자 수익과 위험 비교",
    scenario: "여러 선택지의 기대수익과 변동성을 비교해 의사결정을 해야 합니다.",
    essentialQuestion: "평균만 볼 때와 위험까지 볼 때 결론이 어떻게 달라질까?",
    mathModel: "평균, 분산(또는 표준편차), 확률로 선택지를 비교합니다.",
    strategyHint: "수익 크기와 변동성(위험)을 함께 표로 비교해 보세요.",
    conceptSummary: "평균, 분산, 확률적 판단",
    difficulty: "challenge",
    estimatedMinutes: 5,
    tags: ["금융", "통계", "의사결정"],
  },
];

export function getMissionsByGradeKey(gradeKey: MathGradeKey): MathMission[] {
  if (gradeKey === "middle-1") return MATH_MISSIONS.filter((m) => m.schoolLevel === "middle" && m.grade === 1);
  if (gradeKey === "middle-2") return MATH_MISSIONS.filter((m) => m.schoolLevel === "middle" && m.grade === 2);
  if (gradeKey === "middle-3") return MATH_MISSIONS.filter((m) => m.schoolLevel === "middle" && m.grade === 3);
  return MATH_MISSIONS.filter((m) => m.schoolLevel === "high");
}

export function getMathMissionById(missionId: string): MathMission | null {
  return MATH_MISSIONS.find((mission) => mission.id === missionId) ?? null;
}

export function getTodayMathMission(source: MathMission[] = MATH_MISSIONS): MathMission | null {
  if (source.length === 0) return null;
  const key = new Date().toISOString().slice(0, 10);
  const hash = Array.from(key).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return source[hash % source.length] ?? source[0];
}
