import { FormEvent, useState } from "react";

type InputBoxProps = {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  submitLabel?: string;
  value?: string;
  onChange?: (value: string) => void;
};

export default function InputBox({
  onSubmit,
  placeholder,
  disabled = false,
  submitLabel = "보내기",
  value,
  onChange,
}: InputBoxProps) {
  const [internalValue, setInternalValue] = useState("");
  const currentValue = value ?? internalValue;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = currentValue.trim();
    if (!next || disabled) return;
    onSubmit(next);
    if (value === undefined) setInternalValue("");
  }

  function handleChange(next: string) {
    if (onChange) onChange(next);
    if (value === undefined) setInternalValue(next);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
      <label className="mb-2 block text-xs font-medium text-slate-400">한 줄로 답해 보세요</label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={currentValue}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || !currentValue.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[112px]"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
