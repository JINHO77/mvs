export const STUDENT_DASHBOARD_TEXT = {
  title: "학생 대시보드",
  subtitle: "학습 현황과 알리미를 확인하세요.",
  comingSoon: "준비 중",
  quickLinks: "빠른 실행",
  quickLinksDescription: "학습 준비에 필요한 메뉴로 바로 이동합니다.",
  summaryCards: [
    {
      title: "학습",
      description: "학습 기능 연동 시 진도 흐름을 확인할 수 있습니다.",
    },
    {
      title: "미션",
      description: "오늘 해야 할 미션을 체계적으로 안내합니다.",
    },
    {
      title: "출석",
      description: "출석 기록을 안정적으로 관리할 수 있습니다.",
    },
    {
      title: "알리미",
      description: "중요 알리미를 빠르게 확인할 수 있습니다.",
    },
  ],
  menus: [
    {
      href: "/student/setup",
      label: "프로필 설정",
      description: "학습 준비를 위해 기본 정보를 최신 상태로 관리합니다.",
    },
    {
      href: "/announcements",
      label: "전체 알리미",
      description: "학원 알리미와 일정 안내를 빠르게 확인합니다.",
    },
  ],
} as const;
