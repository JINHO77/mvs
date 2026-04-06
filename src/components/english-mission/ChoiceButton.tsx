type ChoiceButtonProps = {
  text: string;
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
};

export default function ChoiceButton({ text, onClick, selected = false, disabled = false }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-2xl border px-4 py-4 text-left text-sm leading-6 transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-emerald-300 bg-emerald-500/15 text-white shadow-[0_0_0_1px_rgba(110,231,183,0.18)]"
          : "border-slate-700 bg-slate-950/70 text-slate-100 hover:border-emerald-400/50 hover:bg-slate-900 active:border-emerald-300/60"
      }`}
    >
      {text}
    </button>
  );
}
