"use client";

import { useEffect, useMemo, useState } from "react";

export type StudentSearchItem = {
  id: string;
  name: string | null;
  school_level: "elem" | "mid" | "high" | null;
  grade: number | null;
  class_label: string | null;
  student_no?: string | null;
};

type Props = {
  students: StudentSearchItem[];
  selectedStudentId: string | null;
  onSelect: (studentId: string) => void;
  disabled?: boolean;
};

const DEBOUNCE_MS = 300;

type SchoolLevelFilter = "" | "elem" | "mid" | "high";

type GradeOption = {
  value: string;
  label: string;
};

function schoolLevelLabel(level: StudentSearchItem["school_level"]): string {
  if (level === "elem") return "\uCD08\uB4F1";
  if (level === "mid") return "\uC911\uB4F1";
  if (level === "high") return "\uACE0\uB4F1";
  return "";
}

function buildGradeOptions(level: SchoolLevelFilter): GradeOption[] {
  if (level === "elem") {
    return Array.from({ length: 6 }, (_, index) => {
      const grade = index + 1;
      return { value: String(grade), label: `${grade}\uD559\uB144` };
    });
  }
  if (level === "mid" || level === "high") {
    return Array.from({ length: 3 }, (_, index) => {
      const grade = index + 1;
      return { value: String(grade), label: `${grade}\uD559\uB144` };
    });
  }

  const allOptions: GradeOption[] = [];
  for (const [schoolLevel, maxGrade] of [
    ["elem", 6],
    ["mid", 3],
    ["high", 3],
  ] as const) {
    for (let grade = 1; grade <= maxGrade; grade += 1) {
      allOptions.push({
        value: `${schoolLevel}-${grade}`,
        label: `${schoolLevelLabel(schoolLevel)} ${grade}\uD559\uB144`,
      });
    }
  }
  return allOptions;
}

function formatStudentLabel(student: StudentSearchItem): string {
  const name = student.name?.trim() || student.id.slice(0, 8);
  const level = schoolLevelLabel(student.school_level);
  const gradeLabel = student.grade != null ? `${student.grade}\uD559\uB144` : "\uD559\uB144 \uBBF8\uC815";
  const classLabel = student.class_label?.trim() ? ` ${student.class_label.trim()}\uBC18` : "";
  return `${level ? `${level} ` : ""}${gradeLabel}${classLabel} ${name}`.trim();
}

export default function StudentSearchSelect({ students, selectedStudentId, onSelect, disabled = false }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [schoolLevelFilter, setSchoolLevelFilter] = useState<SchoolLevelFilter>("");
  const [gradeFilter, setGradeFilter] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const gradeOptions = useMemo(() => buildGradeOptions(schoolLevelFilter), [schoolLevelFilter]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (schoolLevelFilter && student.school_level !== schoolLevelFilter) return false;
      if (gradeFilter) {
        if (schoolLevelFilter) {
          if (student.grade !== Number(gradeFilter)) return false;
        } else {
          const [level, grade] = gradeFilter.split("-");
          if (student.school_level !== level || student.grade !== Number(grade)) return false;
        }
      }
      if (!debouncedQuery) return true;

      const name = (student.name ?? "").toLowerCase();
      const schoolLevelText = schoolLevelLabel(student.school_level).toLowerCase();
      const gradeText = student.grade != null ? String(student.grade) : "";
      const classLabel = (student.class_label ?? "").toLowerCase();
      const studentNo = (student.student_no ?? "").toLowerCase();
      return (
        name.includes(debouncedQuery)
        || schoolLevelText.includes(debouncedQuery)
        || gradeText.includes(debouncedQuery)
        || classLabel.includes(debouncedQuery)
        || studentNo.includes(debouncedQuery)
      );
    });
  }, [students, debouncedQuery, schoolLevelFilter, gradeFilter]);

  const selectedLabel = useMemo(() => {
    if (!selectedStudentId) return "\uC120\uD0DD\uB41C \uD559\uC0DD \uC5C6\uC74C";
    const selected = students.find((student) => student.id === selectedStudentId);
    return selected ? formatStudentLabel(selected) : "\uC120\uD0DD\uB41C \uD559\uC0DD \uC5C6\uC74C";
  }, [students, selectedStudentId]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-[var(--text-muted)] md:col-span-2">
          {"\uD559\uC0DD \uC774\uB984 \uAC80\uC0C9"}
          <input
            type="text"
            className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={"\uD559\uC0DD \uC774\uB984 \uAC80\uC0C9"}
            disabled={disabled}
          />
        </label>
        <label className="text-sm text-[var(--text-muted)]">
          {"\uD559\uAD50\uAE09 \uD544\uD130"}
          <select
            className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
            value={schoolLevelFilter}
            onChange={(e) => {
              const nextLevel = e.target.value as SchoolLevelFilter;
              setSchoolLevelFilter(nextLevel);
              setGradeFilter("");
            }}
            disabled={disabled}
          >
            <option value="">{"\uC804\uCCB4"}</option>
            <option value="elem">{"\uCD08\uB4F1"}</option>
            <option value="mid">{"\uC911\uB4F1"}</option>
            <option value="high">{"\uACE0\uB4F1"}</option>
          </select>
        </label>
        <label className="text-sm text-[var(--text-muted)]">
          {"\uD559\uB144 \uD544\uD130"}
          <select
            className="mt-1 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            disabled={disabled}
          >
            <option value="">{"\uC804\uCCB4"}</option>
            {gradeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
          {"\uAC80\uC0C9 \uACB0\uACFC"} {filteredStudents.length}
          {"\uBA85"}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filteredStudents.length === 0 ? (
            <div className="px-3 py-3 text-sm text-[var(--text-muted)]">{"\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</div>
          ) : (
            filteredStudents.map((student) => {
              const active = student.id === selectedStudentId;
              return (
                <button
                  key={student.id}
                  type="button"
                  className={`block w-full border-b border-[var(--border)] px-4 py-3 text-left text-sm last:border-b-0 ${
                    active ? "bg-[var(--accent)]/10 text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--card-strong)]"
                  }`}
                  onClick={() => onSelect(student.id)}
                  disabled={disabled}
                >
                  {formatStudentLabel(student)}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="text-xs text-[var(--text-muted)]">
        {"\uC120\uD0DD\uB428"}: {selectedLabel}
      </div>
    </div>
  );
}
