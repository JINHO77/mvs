export type ConceptNode = {
  id: string;
  displayName: string;
  shortDescription: string;
  prerequisites: string[];
  next: string[];
};

export const CONCEPT_MAP: Record<string, ConceptNode> = {
  expression: {
    id: "expression",
    displayName: "문자와 식",
    shortDescription: "생활 속 상황을 식으로 바꾸는 연습이 필요해요.",
    prerequisites: [],
    next: ["variable_meaning", "substitution", "linear_modeling"],
  },
  variable_meaning: {
    id: "variable_meaning",
    displayName: "문자의 의미",
    shortDescription: "문자가 무엇을 나타내는지 분명히 읽는 연습이 필요해요.",
    prerequisites: ["expression"],
    next: ["substitution", "linear_modeling"],
  },
  substitution: {
    id: "substitution",
    displayName: "식에 값 대입하기",
    shortDescription: "식에 값을 넣어 해석하는 연습을 더 해보면 좋아요.",
    prerequisites: ["expression", "variable_meaning"],
    next: ["linear_modeling"],
  },
  linear_modeling: {
    id: "linear_modeling",
    displayName: "일차식 모델링",
    shortDescription: "고정된 값과 일정한 변화를 식으로 만드는 연습이 필요해요.",
    prerequisites: ["expression", "substitution"],
    next: ["graph_interpretation"],
  },
  graph_interpretation: {
    id: "graph_interpretation",
    displayName: "그래프 해석",
    shortDescription: "그래프의 모양과 뜻을 상황에 연결하는 연습이 필요해요.",
    prerequisites: ["linear_modeling"],
    next: ["quadratic_vertex", "quadratic_max_min"],
  },
  quadratic_vertex: {
    id: "quadratic_vertex",
    displayName: "이차함수 꼭짓점",
    shortDescription: "그래프에서 가장 높은 점이나 낮은 점의 뜻을 다시 연습해 보세요.",
    prerequisites: ["graph_interpretation"],
    next: ["quadratic_max_min"],
  },
  quadratic_max_min: {
    id: "quadratic_max_min",
    displayName: "이차함수 최대·최소",
    shortDescription: "최고점과 최저점을 상황과 연결하는 연습이 더 필요해요.",
    prerequisites: ["quadratic_vertex"],
    next: [],
  },
  ratio_proportion: {
    id: "ratio_proportion",
    displayName: "비례",
    shortDescription: "양이 함께 변하는 관계를 다시 살펴보면 좋아요.",
    prerequisites: [],
    next: ["linear_modeling", "graph_interpretation"],
  },
};

export function getConceptNode(conceptId: string): ConceptNode | null {
  return CONCEPT_MAP[conceptId] ?? null;
}
