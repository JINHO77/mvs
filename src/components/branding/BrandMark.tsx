type BrandMarkProps = {
  compact?: boolean;
};

export default function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={compact ? "inline-flex flex-col" : "inline-flex flex-col"}>
      <span
        className="text-2xl font-extrabold tracking-[0.18em] leading-none sm:text-3xl"
        style={{
          backgroundImage: "linear-gradient(120deg, #F6E7AE 0%, #D4AF37 45%, #B5861E 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          textShadow: "0 0 18px rgba(212,175,55,0.28)",
        }}
      >
        MVS
      </span>
      <span className="mt-1 text-[11px] tracking-[0.12em] text-[var(--text-muted)] sm:text-xs">
        Most Valuable Student
      </span>
    </div>
  );
}
