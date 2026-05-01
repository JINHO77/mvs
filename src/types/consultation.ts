export type ConsultationStatus =
  | 'requested'
  | 'confirmed'
  | 'canceled'
  | 'done'
  | 'no_show'
  | 'rescheduled';

export type ConsultationType = 'in_person' | 'phone' | 'video';

export type ConsultationPriority = 'urgent' | 'high' | 'normal' | 'low';

export type SchoolLevel = 'elementary' | 'middle' | 'high';

export type LinkStatus = 'linked' | 'manual_only';

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  elementary: '초등',
  middle: '중등',
  high: '고등',
};

export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  in_person: '대면',
  phone: '전화',
  video: '화상',
};

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  requested: '대기',
  confirmed: '확정',
  rescheduled: '일정변경',
  canceled: '취소',
  done: '완료',
  no_show: '불참',
};

export interface ConsultationRequestDisplay {
  id: string;
  student_id: string | null;
  guardian_id: string | null;
  requested_start_at: string;
  duration_min: number;
  type: ConsultationType;
  status: ConsultationStatus;
  priority: ConsultationPriority | null;
  notes: string | null;
  entry_mode: string | null;
  owner_note: string | null;
  video_link: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string | null;
  // v_consultation_requests_display — computed columns
  student_name: string | null;         // COALESCE(profile.name, manual_student_name)
  school_level: SchoolLevel | null;    // enum: elementary | middle | high
  grade: number | null;
  class_label: string | null;
  student_no: string | null;           // COALESCE(profile student_no, manual_student_no)
  school_level_ko: string | null;      // '초등' | '중등' | '고등' | ''
  student_info_display: string | null; // e.g. "중등 1학년" or "고등 3학년 1반"
  guardian_contact: string | null;
  link_status: LinkStatus | null;
  consultation_content: string | null;
}
