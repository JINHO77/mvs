import type { CSSProperties } from "react";

type MvsLogoMarkProps = {
  size?: number;
  showText?: boolean;
  className?: string;
};

export default function MvsLogoMark({ size = 28, showText = true, className }: MvsLogoMarkProps) {
  const width = showText ? (size / 72) * 240 : size;
  const style: CSSProperties = {
    height: `${size}px`,
    width: `${width}px`,
  };

  return (
    <svg
      viewBox="0 0 240 72"
      style={style}
      className={className}
      role="img"
      aria-label="MVS"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <g transform="translate(2,2)">
        <rect x="0" y="0" width="68" height="68" rx="20" stroke="var(--border)" strokeWidth="2" />
        <circle cx="34" cy="34" r="18" stroke="var(--accent)" strokeWidth="2.5" />
        <path d="M22 38C26 31 32 28 38 29C43 30 48 34 50 39" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <text x="34" y="38" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fontWeight="700" fill="var(--accent)">
          mvs
        </text>
      </g>
      {showText ? (
        <>
          <text x="82" y="34" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="800" letterSpacing="1.2" fill="var(--accent)">
            MVS
          </text>
          <text x="82" y="50" fontFamily="Arial, sans-serif" fontSize="8.5" fontWeight="600" letterSpacing="0.8" fill="var(--text-muted)">
            MOST VALUABLE STUDENT
          </text>
        </>
      ) : null}
    </svg>
  );
}
