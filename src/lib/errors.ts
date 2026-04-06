import { toPrettyErrorString } from "@/lib/supabaseError";

const UUID_REQUIRED_MESSAGE = "학생 선택이 필요합니다. 학생을 선택한 뒤 저장/발송을 진행해 주세요.";
const ACADEMY_REQUIRED_MESSAGE = "학원 정보가 아직 설정되지 않았습니다. 원장 계정에 학원 소속(academy_id)을 먼저 설정해 주세요.";

export function prettyUserError(error: unknown): string {
  const raw = toPrettyErrorString(error);
  const normalized = raw.toLowerCase();

  if (normalized.includes("invalid input syntax for type uuid")) {
    return UUID_REQUIRED_MESSAGE;
  }
  if ((normalized.includes("student_id") || normalized.includes("report_id") || normalized.includes("academy_id")) && normalized.includes("\"\"")) {
    return UUID_REQUIRED_MESSAGE;
  }
  if (normalized.includes("academy_id") && (normalized.includes("missing") || normalized.includes("invalid") || normalized.includes("올바르지"))) {
    return ACADEMY_REQUIRED_MESSAGE;
  }
  if (normalized.includes("로그인이 필요")) return "로그인이 필요합니다. 다시 로그인해 주세요.";
  if (normalized.includes("권한")) return "권한이 없습니다. 관리자에게 문의해 주세요.";

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
