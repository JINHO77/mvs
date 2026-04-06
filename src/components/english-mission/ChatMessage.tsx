import { normalizeUiText } from "@/lib/uiText";

type ChatMessageProps = {
  role: "npc" | "user";
  text: string;
};

export default function ChatMessage({ role, text }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-[0_14px_34px_rgba(2,6,23,0.18)] md:max-w-[72%] ${
          isUser
            ? "rounded-br-md border border-emerald-300/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.28),rgba(20,184,166,0.18))] text-emerald-50"
            : "rounded-bl-md border border-slate-700/80 bg-[rgba(15,23,42,0.92)] text-slate-100"
        }`}
      >
        {normalizeUiText(text)}
      </div>
    </div>
  );
}
