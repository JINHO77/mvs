"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onResult: (code: string) => void;
  onClose: () => void;
};

const SCANNER_ELEMENT_ID = "mvs-qr-scanner-region";

function extractCode(decoded: string): string | null {
  const trimmed = decoded.trim();
  if (!trimmed) return null;

  const direct = trimmed.toUpperCase();
  if (/^[A-Z0-9]{6}$/.test(direct) || /^[A-Z0-9]{8}$/.test(direct)) {
    return direct;
  }

  try {
    const parsed = new URL(trimmed);
    const fromQuery = parsed.searchParams.get("code");
    if (fromQuery) {
      const cleaned = fromQuery.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (cleaned.length === 6 || cleaned.length === 8) return cleaned;
    }
  } catch {
    // not a URL; fall through
  }

  const stripped = direct.replace(/[^A-Z0-9]/g, "");
  if (stripped.length === 6 || stripped.length === 8) return stripped;
  if (stripped.length > 8) {
    const eight = stripped.slice(0, 8);
    if (/^[A-Z0-9]{8}$/.test(eight)) return eight;
  }
  return null;
}

export default function QrScannerModal({ onResult, onClose }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const handledRef = useRef(false);
  const [status, setStatus] = useState<"starting" | "scanning" | "denied" | "error">("starting");
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled) return;

        const Html5Qrcode = mod.Html5Qrcode;
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (handledRef.current) return;
            const code = extractCode(decoded);
            if (!code) return;
            handledRef.current = true;
            void scanner
              .stop()
              .catch(() => undefined)
              .finally(() => {
                onResult(code);
              });
          },
          () => undefined,
        );

        if (!cancelled) setStatus("scanning");
      } catch (e: unknown) {
        if (cancelled) return;
        const name = (e as { name?: string } | null)?.name ?? "";
        const message =
          e instanceof Error ? e.message : typeof e === "string" ? e : "카메라를 시작할 수 없어요.";

        if (name === "NotAllowedError" || /permission/i.test(message)) {
          setStatus("denied");
          setErrorText("카메라 접근 권한을 허용해주세요. 브라우저 주소창의 카메라 아이콘에서 권한을 다시 설정할 수 있어요.");
        } else if (name === "NotFoundError" || /not\s*found/i.test(message)) {
          setStatus("error");
          setErrorText("사용 가능한 카메라를 찾지 못했어요.");
        } else if (/secure|https/i.test(message)) {
          setStatus("error");
          setErrorText("카메라는 보안 연결(HTTPS)에서만 사용할 수 있어요.");
        } else {
          setStatus("error");
          setErrorText(message);
        }
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // noop
            }
          });
      }
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,11,20,0.82)] p-4">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow)]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[var(--text)]">📷 QR 스캔하기</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">QR 코드를 화면 안에 맞춰주세요.</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
          <div id={SCANNER_ELEMENT_ID} className="aspect-square w-full" />
        </div>

        {status === "starting" && (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card-soft)] p-3 text-xs text-[var(--text-muted)]">
            카메라를 준비하고 있어요...
          </div>
        )}

        {(status === "denied" || status === "error") && errorText && (
          <div className="mt-3 rounded-xl border border-[var(--danger-text)] bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger-text)]">
            ⚠️ {errorText}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--card-soft)] px-4 py-3 text-sm font-medium text-[var(--text)]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
