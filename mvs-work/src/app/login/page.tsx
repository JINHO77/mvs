"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage("로그인에 실패했습니다. 계정이 없다면 먼저 가입을 눌러주세요.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignUp() {
    setLoading(true);
    setMessage("");
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setLoading(false);

    if (error) {
      setMessage("가입에 실패했습니다. 이메일과 비밀번호를 다시 확인해주세요.");
      return;
    }

    setMessage("가입이 완료되었습니다. 이메일 확인 설정이 켜져 있다면 메일을 확인해주세요.");
  }

  return (
    <div className="mx-auto max-w-md rounded-lg border border-line bg-white p-6">
      <h1 className="text-2xl font-bold text-ink">로그인</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Supabase 이메일/비밀번호 계정으로 MVP를 사용합니다.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-ink">
          이메일
          <input
            className="mt-2 w-full rounded-md border border-line px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="예: manager@example.com"
            required
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          비밀번호
          <input
            className="mt-2 w-full rounded-md border border-line px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="6자 이상 비밀번호"
            required
          />
        </label>
        {message ? <p className="rounded-md bg-paper p-3 text-sm text-muted">{message}</p> : null}
        <div className="flex gap-3">
          <button
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "처리 중..." : "로그인"}
          </button>
          <button
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
            disabled={loading || !email || !password}
            onClick={handleSignUp}
            type="button"
          >
            가입
          </button>
        </div>
      </form>
    </div>
  );
}
