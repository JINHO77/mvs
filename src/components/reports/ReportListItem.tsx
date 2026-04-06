"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatReportMonth,
  getBadgeClassName,
  getParentLinkStatus,
  getStudentConfirmStatus,
  getStudentReadStatus,
  type ReportListItem,
} from "@/lib/reports";

type ReportListItemProps = {
  item: ReportListItem;
  href: string;
  showStudentName?: boolean;
  action?: ReactNode;
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR");
}

function renderStatusBadges(item: ReportListItem) {
  const studentReadBadge = getStudentReadStatus(item.student_read);
  const parentLinkBadge = getParentLinkStatus(item.current_parent_linked);
  const studentConfirmBadge = getStudentConfirmStatus(item.student_confirmed);

  return (
    <>
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getBadgeClassName(studentReadBadge.tone)}`}>
        {studentReadBadge.label}
      </span>
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getBadgeClassName(parentLinkBadge.tone)}`}>
        {parentLinkBadge.label}
      </span>
      {studentConfirmBadge && (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getBadgeClassName(studentConfirmBadge.tone)}`}>
          {studentConfirmBadge.label}
        </span>
      )}
    </>
  );
}

export default function ReportListItemCard({ item, href, showStudentName = false, action }: ReportListItemProps) {
  const hasStudentUnread = !item.student_read;
  const hasMissingParentLink = !item.current_parent_linked;
  const cardClassName = hasStudentUnread
    ? "border-[var(--danger-text)]"
    : hasMissingParentLink
      ? "border-[var(--accent)]"
      : "border-[var(--border)]";

  return (
    <div className={`rounded-2xl border bg-[var(--card)] p-4 shadow-[var(--shadow)] transition hover:border-[var(--accent)] md:p-5 lg:p-6 ${cardClassName}`}>
      <Link href={href} className="block">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-[var(--text)] md:text-lg">{formatReportMonth(item.month)} 리포트</h3>
              {!item.is_read && (
                <span className="inline-flex rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                  미열람
                </span>
              )}
              {renderStatusBadges(item)}
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {formatReportMonth(item.month)}
              {showStudentName && item.student_name ? ` · ${item.student_name}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5">
                수학 PDF {item.math_pdf_path ? "있음" : "없음"}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5">
                영어 지표 {item.english_metrics ? "있음" : "없음"}
              </span>
              {item.student_read_at && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--card-soft)] px-2 py-0.5">
                  학생 열람 {formatDate(item.student_read_at)}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] md:shrink-0">{formatDate(item.created_at)}</p>
        </div>
      </Link>
      {(item.last_announced_at || action) && (
        <div className="mt-3 flex flex-col gap-3 border-t border-[var(--border)] pt-3 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-[var(--text-muted)]">
            {item.last_announced_at ? `최근 발송: ${formatDate(item.last_announced_at)}` : "최근 발송 이력 없음"}
          </div>
          {action ? <div className="w-full md:w-auto">{action}</div> : null}
        </div>
      )}
    </div>
  );
}
