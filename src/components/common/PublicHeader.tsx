import MvsHeaderLogo from "@/components/brand/MvsHeaderLogo";
import ThemeToggle from "@/components/theme/ThemeToggle";

type PublicHeaderProps = {
  className?: string;
};

export default function PublicHeader({ className = "" }: PublicHeaderProps) {
  return (
    <header className={`w-full border-b border-[var(--border)] bg-[var(--bg)] ${className}`.trim()}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <MvsHeaderLogo href="/" size="lg" />
        <ThemeToggle />
      </div>
    </header>
  );
}
