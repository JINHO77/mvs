export type ConceptDefinition = {
  id: string;
  label: string;
  description: string;
  recommendation: string;
  prerequisites: string[];
  next: string[];
};

export const CONCEPTS: Record<string, ConceptDefinition> = {
  division_meaning: {
    id: "division_meaning",
    label: "나눗셈의 의미",
    description: "전체를 같은 수로 나누는 뜻을 이해하는 개념이에요.",
    recommendation: "전체를 공평하게 나누는 상황을 다시 생각해 보면 좋아요.",
    prerequisites: [],
    next: ["fraction_intro"],
  },
  fraction_intro: {
    id: "fraction_intro",
    label: "분수의 도입",
    description: "1보다 작은 몫을 분수로 나타내는 개념이에요.",
    recommendation: "나눗셈 결과를 분수로 읽는 연습을 더 해보면 좋아요.",
    prerequisites: ["division_meaning"],
    next: [],
  },
  percent_meaning: {
    id: "percent_meaning",
    label: "백분율의 의미",
    description: "100을 기준으로 양을 비교하는 개념이에요.",
    recommendation: "퍼센트를 소수나 분수로 바꾸는 연습이 더 필요해요.",
    prerequisites: [],
    next: ["percent_discount", "percent_comparison"],
  },
  percent_discount: {
    id: "percent_discount",
    label: "할인율 계산",
    description: "할인 비율을 실제 금액 계산에 연결하는 개념이에요.",
    recommendation: "할인율을 실제 가격 계산에 연결하는 연습이 더 필요해요.",
    prerequisites: ["percent_meaning"],
    next: ["percent_comparison"],
  },
  percent_comparison: {
    id: "percent_comparison",
    label: "백분율 비교",
    description: "여러 할인이나 혜택을 같은 기준으로 비교하는 개념이에요.",
    recommendation: "여러 혜택을 같은 기준으로 비교하는 연습을 다시 해보면 좋아요.",
    prerequisites: ["percent_meaning", "percent_discount"],
    next: [],
  },
  expression_modeling: {
    id: "expression_modeling",
    label: "문자와 식",
    description: "생활 속 상황을 식으로 바꾸는 개념이에요.",
    recommendation: "생활 속 상황을 식으로 바꾸는 연습이 더 필요해요.",
    prerequisites: [],
    next: ["variable_meaning", "substitution", "linear_modeling", "equation_modeling"],
  },
  variable_meaning: {
    id: "variable_meaning",
    label: "문자의 의미",
    description: "문자가 어떤 양을 나타내는지 읽는 개념이에요.",
    recommendation: "문자가 무엇을 뜻하는지 분명히 읽는 연습을 다시 해보면 좋아요.",
    prerequisites: ["expression_modeling"],
    next: ["substitution"],
  },
  substitution: {
    id: "substitution",
    label: "값 대입",
    description: "식에 값을 넣어 결과를 해석하는 개념이에요.",
    recommendation: "식에 값을 넣어 계산하고 뜻을 읽는 연습이 더 필요해요.",
    prerequisites: ["expression_modeling", "variable_meaning"],
    next: ["linear_modeling"],
  },
  equation_modeling: {
    id: "equation_modeling",
    label: "방정식 모델링",
    description: "상황을 식과 방정식으로 표현하는 개념이에요.",
    recommendation: "조건을 식으로 옮기는 연습을 다시 해보면 좋아요.",
    prerequisites: ["expression_modeling"],
    next: ["simultaneous_equations_intro"],
  },
  simultaneous_equations_intro: {
    id: "simultaneous_equations_intro",
    label: "연립방정식 기초",
    description: "두 조건을 동시에 만족하는 값을 찾는 개념이에요.",
    recommendation: "두 조건을 함께 만족하는 값을 찾는 연습이 더 필요해요.",
    prerequisites: ["equation_modeling"],
    next: [],
  },
  linear_modeling: {
    id: "linear_modeling",
    label: "일차식 모델링",
    description: "기본값과 일정한 변화를 식으로 나타내는 개념이에요.",
    recommendation: "기본값과 변화량을 하나의 식으로 만드는 연습이 더 필요해요.",
    prerequisites: ["expression_modeling", "substitution"],
    next: ["graph_interpretation"],
  },
  graph_interpretation: {
    id: "graph_interpretation",
    label: "그래프 해석",
    description: "그래프의 모양과 뜻을 상황에 연결하는 개념이에요.",
    recommendation: "그래프에서 읽은 정보를 실제 상황과 연결하는 연습이 더 필요해요.",
    prerequisites: ["linear_modeling"],
    next: ["quadratic_vertex"],
  },
  quadratic_vertex: {
    id: "quadratic_vertex",
    label: "이차함수 꼭짓점",
    description: "그래프에서 가장 높은 점이나 낮은 점의 의미를 읽는 개념이에요.",
    recommendation: "그래프에서 가장 높은 점의 의미를 다시 연습해 보면 좋아요.",
    prerequisites: ["graph_interpretation"],
    next: [],
  },
};

export function getConcept(conceptId: string): ConceptDefinition | null {
  return CONCEPTS[conceptId] ?? null;
}
