"use client";

import { useState } from "react";
import SectionCard from "@/components/ui/SectionCard";
import { supabase } from "@/lib/supabaseClient";
import { toPrettyErrorString } from "@/lib/supabaseError";

const FIELD_CLASS_NAME =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]";

export default function PasswordChangeCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!currentPassword) {
      setErrorMessage("현재 비밀번호를 입력해 주세요.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("새 비밀번호는 6자 이상이어야 해요.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setErrorMessage("새 비밀번호가 서로 일치하지 않아요.");
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage("새 비밀번호는 현재 비밀번호와 달라야 해요.");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user?.email) {
        setErrorMessage("세션 정보를 확인하지 못했어요. 다시 로그인 후 시도해 주세요.");
        return;
      }

      const email = session.user.email;

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (signInError) {
        const pretty = toPrettyErrorString(signInError).toLowerCase();
        if (pretty.includes("invalid") || pretty.includes("credentials")) {
          setErrorMessage("현재 비밀번호가 올바르지 않아요.");
        } else {
          setErrorMessage("현재 비밀번호 확인 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
        }
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        const pretty = toPrettyErrorString(updateError);
        setErrorMessage(`비밀번호를 변경하지 못했어요. (${pretty})`);
        return;
      }

      setSuccessMessage("비밀번호가 변경되었어요.");
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionCard
      header="🔒 비밀번호 변경"
      description="현재 비밀번호를 확인한 뒤 새 비밀번호를 설정해요."
    >
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        {errorMessage && (
          <div className="rounded-2xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger-text)]">
            ⚠️ {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-[var(--success-text)] bg-[var(--success-bg)] p-4 text-sm text-[var(--success-text)]">
            ✅ {successMessage}
          </div>
        )}

        <label className="block space-y-2">
          <span className="text-sm text-[var(--text-muted)]">현재 비밀번호</span>
          <input
            type="password"
            autoComplete="current-password"
            className={FIELD_CLASS_NAME}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="현재 사용 중인 비밀번호"
            disabled={submitting}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-[var(--text-muted)]">새 비밀번호 (6자 이상)</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            className={FIELD_CLASS_NAME}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="새 비밀번호"
            disabled={submitting}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-[var(--text-muted)]">새 비밀번호 확인</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            className={FIELD_CLASS_NAME}
            value={newPasswordConfirm}
            onChange={(event) => setNewPasswordConfirm(event.target.value)}
            placeholder="새 비밀번호 다시 입력"
            disabled={submitting}
            required
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--bg)] disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </SectionCard>
  );
}
