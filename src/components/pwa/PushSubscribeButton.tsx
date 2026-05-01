"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Status = "checking" | "ready";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari
  return Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua);
}

export default function PushSubscribeButton() {
  const [status, setStatus] = useState<Status>("checking");
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requireStandalone, setRequireStandalone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const ok =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (cancelled) return;
      setSupported(ok);
      if (!ok) {
        setStatus("ready");
        return;
      }

      // iOS는 홈 화면에 추가된 PWA에서만 푸시 가능 (Safari 탭에서는 X)
      if (isIOS() && !isStandalone()) {
        setRequireStandalone(true);
        setStatus("ready");
        return;
      }

      setPermission(Notification.permission);

      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        setIsSubscribed(Boolean(existing));
      } catch (err) {
        console.warn("[push] sw ready check failed", err);
      }
      if (!cancelled) setStatus("ready");
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = async () => {
    setErrorMsg(null);

    if (!VAPID_PUBLIC_KEY) {
      setErrorMsg("푸시 알림 설정이 누락됐어요. 관리자에게 문의해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setErrorMsg(perm === "denied" ? "알림 권한이 차단됐어요." : "알림 권한이 필요해요.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      });

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("로그인이 필요해요.");

      const subJson = sub.toJSON();
      const keys = subJson.keys ?? {};
      const p256dh = keys.p256dh;
      const auth = keys.auth;
      if (!p256dh || !auth) throw new Error("구독 정보가 올바르지 않아요.");

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: sub.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          is_active: true,
        },
        { onConflict: "user_id,endpoint" },
      );
      if (error) throw error;

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "알림 구독에 실패했어요.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("endpoint", sub.endpoint);
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
      setErrorMsg(err instanceof Error ? err.message : "알림 해제에 실패했어요.");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "checking") {
    return <p className="text-sm text-[var(--text-muted)]">확인 중...</p>;
  }

  if (!supported) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        이 브라우저는 푸시 알림을 지원하지 않아요.
      </p>
    );
  }

  if (requireStandalone) {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium text-[var(--text)]">📱 iPhone에서는 ''홈 화면에 추가'' 후에만 알림을 받을 수 있어요.</p>
        <p className="text-[var(--text-muted)]">Safari 공유 메뉴 → ''홈 화면에 추가''를 눌러 앱처럼 설치한 뒤, 홈 화면 아이콘으로 다시 들어와 ''알림 받기''를 눌러주세요.</p>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <p className="text-sm text-[var(--danger-text)]">
        ⚠️ 알림이 차단됐어요. 브라우저 설정에서 ''알림 허용''으로 바꾼 뒤 다시 시도해주세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {isSubscribed ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--success-text)]">✅ 알림을 받고 있어요</p>
          <button
            type="button"
            onClick={() => void handleUnsubscribe()}
            disabled={isLoading}
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--accent)] disabled:opacity-60"
          >
            {isLoading ? "처리 중..." : "알림 끄기"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void handleSubscribe()}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isLoading ? "설정 중..." : "🔔 알림 받기"}
        </button>
      )}
      {errorMsg && (
        <p className="text-sm text-[var(--danger-text)]">⚠️ {errorMsg}</p>
      )}
    </div>
  );
}
