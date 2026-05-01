import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type ProfileRow = { account_status: string | null; name: string | null };

export default async function BlockedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let status: string | null = null;
  let name: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("account_status, name")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>();
    status = data?.account_status ?? null;
    name = data?.name ?? null;
  }

  const isPending = status === "pending";
  const isBlocked = status === "blocked";
  const isArchived = status === "archived";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          padding: "2.5rem",
          borderRadius: 16,
          background: "var(--card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
        }}
      >
        {isPending && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>승인 대기 중이에요</h1>
            <p style={{ color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
              {name ? `${name}님, ` : ""}원장님의 가입 승인을 기다리고 있어요.
              <br />
              승인이 완료되면 모든 기능을 자유롭게 이용하실 수 있어요.
            </p>
          </>
        )}
        {isBlocked && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🚫</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>계정이 차단되었어요</h1>
            <p style={{ color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
              계정 사용이 일시적으로 제한되었어요.
              <br />
              자세한 사유는 학원으로 문의해 주세요.
            </p>
          </>
        )}
        {isArchived && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📦</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>탈퇴 처리된 계정이에요</h1>
            <p style={{ color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
              다시 이용하려면 학원에 문의해 주세요.
            </p>
          </>
        )}
        {!isPending && !isBlocked && !isArchived && (
          <>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>접근할 수 없는 페이지예요</h1>
            <p style={{ color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
              현재 계정으로는 이 페이지에 접근할 수 없어요.
            </p>
          </>
        )}
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            style={{
              padding: "0.75rem 1.5rem",
              borderRadius: 12,
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
