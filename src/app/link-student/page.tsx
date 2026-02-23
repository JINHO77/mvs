"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ClaimResult =
  | { ok: true; student_id: string }
  | { ok: false; reason: "CODE_NOT_FOUND" | "CODE_ALREADY_USED" | "CODE_EXPIRED" | string };

export default function LinkStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [relation, setRelation] = useState<string>("guardian"); // mother/father/guardian
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isDevMode = useMemo(() => process.env.NEXT_PUBLIC_DEV_MODE === "true", []);

  useEffect(() => {
    (async () => {
      // Session check
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace(isDevMode ? "/dev-login" : "/login");
        return;
      }
      setLoading(false);
    })();
  }, [router, isDevMode]);

  const prettyReason = (reason: string) => {
    switch (reason) {
      case "CODE_NOT_FOUND":
        return "\uCF54\uB4DC\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uD655\uC778\uD574\uC8FC\uC138\uC694.";
      case "CODE_ALREADY_USED":
        return "\uC774\uBBF8 \uC0AC\uC6A9\uB41C \uCF54\uB4DC\uC785\uB2C8\uB2E4. \uD559\uC6D0\uC5D0 \uC0C8 \uCF54\uB4DC\uB97C \uC694\uCCAD\uD574\uC8FC\uC138\uC694.";
      case "CODE_EXPIRED":
        return "\uCF54\uB4DC\uAC00 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uD559\uC6D0\uC5D0 \uC0C8 \uCF54\uB4DC\uB97C \uC694\uCCAD\uD574\uC8FC\uC138\uC694.";
      default:
        return `\uC5F0\uACB0 \uC2E4\uD328: ${reason}`;
    }
  };

  const submit = async () => {
    setMessage(null);

    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) {
      setMessage("\uCF54\uB4DC\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694. (\uC608: 8\uC790\uB9AC)");
      return;
    }

    setSubmitting(true);
    try {
      // RPC call
      const { data, error } = await supabase.rpc("claim_student_link_code", {
        p_code: trimmed,
        p_relation: relation,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      const res = data as ClaimResult;

      if (!res?.ok) {
        setMessage(prettyReason(res?.reason ?? "UNKNOWN"));
        return;
      }

      setMessage("\uC790\uB140 \uC5F0\uACB0\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
      setTimeout(() => router.push("/parent/students"), 1000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
        {"\uB85C\uB529 \uC911..."}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#1E1E26] bg-[#121218] p-6">
        <h1 className="text-2xl font-semibold">
          <span className="text-[#D4AF37]">MVS</span> {"\uD559\uC0DD \uC5F0\uACB0"}
        </h1>

        <p className="mt-2 text-sm text-[#B8B8C3]">
          {"\uD559\uC6D0\uC5D0\uC11C \uBC1B\uC740 \uC5F0\uACB0\uCF54\uB4DC\uB97C \uC785\uB825\uD558\uBA74 \uD559\uC0DD \uACC4\uC815\uACFC \uC5F0\uACB0\uB429\uB2C8\uB2E4."}
        </p>

        <label className="block text-sm mt-6 mb-2 text-[#B8B8C3]">{"\uC5F0\uACB0\uCF54\uB4DC"}</label>
        <input
          className="w-full rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-4 py-3 outline-none focus:ring-2 focus:ring-[#D4AF37]"
          placeholder={"\uC608: 8\uC790\uB9AC \uCF54\uB4DC"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          autoCorrect="off"
        />

        <label className="block text-sm mt-4 mb-2 text-[#B8B8C3]">{"\uAD00\uACC4(\uC120\uD0DD)"}</label>
        <select
          className="w-full rounded-xl border border-[#1E1E26] bg-[#0B0B0E] px-4 py-3 outline-none focus:ring-2 focus:ring-[#D4AF37] text-[#F5F5F7]"
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
        >
          <option value="guardian">{"\uBCF4\uD638\uC790"}</option>
          <option value="mother">{"\uC5B4\uBA38\uB2C8"}</option>
          <option value="father">{"\uC544\uBC84\uC9C0"}</option>
        </select>

        <button
          className="mt-5 w-full rounded-xl bg-[#D4AF37] px-4 py-3 font-semibold text-black disabled:opacity-60"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "\uC5F0\uACB0 \uC911..." : "\uC5F0\uACB0\uD558\uAE30"}
        </button>

        {message && (
          <div className="mt-4 rounded-xl border border-[#1E1E26] bg-[#0B0B0E] p-3 text-sm text-[#B8B8C3]">
            {message}
          </div>
        )}

        <div className="mt-6 text-xs text-[#6F6F7D]">
          {"\uBB38\uC81C\uAC00 \uACC4\uC18D\uB418\uBA74 \uD559\uC6D0\uC5D0 \uC5F0\uACB0\uCF54\uB4DC\uB97C \uC694\uCCAD\uD574\uC8FC\uC138\uC694."}
        </div>
      </div>
    </main>
  );
}
