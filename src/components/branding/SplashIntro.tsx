"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

const SPLASH_SEEN_KEY = "mvs_splash_seen";
const SPLASH_HOLD_MS = 1300;
const SPLASH_FADE_MS = 180;
const SHINE_START_MS = 980;
const SHINE_DURATION_MS = 520;
const PARTICLES_MIN = 12;
const PARTICLES_MAX = 20;
const PARTICLE_SYMBOLS = [".", "|", "-"] as const;

type Particle = {
  symbol: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size: number;
  delay: number;
  duration: number;
};

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomEdgePoint(): { x: number; y: number } {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: randomBetween(-10, 110), y: randomBetween(-12, 4) };
  if (edge === 1) return { x: randomBetween(96, 112), y: randomBetween(-10, 110) };
  if (edge === 2) return { x: randomBetween(-10, 110), y: randomBetween(96, 112) };
  return { x: randomBetween(-12, 4), y: randomBetween(-10, 110) };
}

function createParticles(): Particle[] {
  const count = Math.floor(randomBetween(PARTICLES_MIN, PARTICLES_MAX + 1));
  return Array.from({ length: count }, () => {
    const start = randomEdgePoint();
    return {
      symbol: PARTICLE_SYMBOLS[Math.floor(Math.random() * PARTICLE_SYMBOLS.length)],
      startX: start.x,
      startY: start.y,
      endX: randomBetween(45, 55),
      endY: randomBetween(45, 55),
      size: randomBetween(10, 16),
      delay: randomBetween(0, 0.35),
      duration: randomBetween(0.9, 1.2),
    };
  });
}

export default function SplashIntro() {
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);
  const [shineActive, setShineActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const particles = useMemo(() => createParticles(), []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = () => setReducedMotion(mediaQuery.matches);
    handleMotionChange();
    mediaQuery.addEventListener("change", handleMotionChange);

    try {
      const seen = sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
      if (seen) {
        mediaQuery.removeEventListener("change", handleMotionChange);
        return;
      }
      sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    } catch {
      // If sessionStorage is unavailable, show once for this render cycle.
    }

    setShouldRender(true);
    const inTimer = window.setTimeout(() => setVisible(true), 10);
    const shineInTimer = window.setTimeout(() => setShineActive(true), SHINE_START_MS);
    const shineOutTimer = window.setTimeout(() => setShineActive(false), SHINE_START_MS + SHINE_DURATION_MS);
    const outTimer = window.setTimeout(() => setVisible(false), SPLASH_HOLD_MS);
    const unmountTimer = window.setTimeout(() => setShouldRender(false), SPLASH_HOLD_MS + SPLASH_FADE_MS);

    return () => {
      window.clearTimeout(inTimer);
      window.clearTimeout(shineInTimer);
      window.clearTimeout(shineOutTimer);
      window.clearTimeout(outTimer);
      window.clearTimeout(unmountTimer);
      mediaQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  if (!shouldRender) return null;

  const transitionClassName = reducedMotion
    ? "transition-opacity duration-150 ease-out"
    : "transition-all duration-500 ease-out";
  const stateClassName = reducedMotion
    ? visible
      ? "opacity-100"
      : "opacity-0"
    : visible
      ? "scale-100 opacity-100"
      : "scale-[0.95] opacity-0";

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-[2px] ${transitionClassName} ${visible ? "opacity-100" : "opacity-0"}`}
      style={{
        backgroundImage:
          "linear-gradient(160deg, rgba(9,14,27,0.94) 0%, rgba(14,21,38,0.93) 58%, rgba(9,14,27,0.95) 100%)",
      }}
      aria-hidden="true"
    >
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {particles.map((particle, idx) => {
            const style = {
              fontSize: `${particle.size}px`,
              left: 0,
              top: 0,
              "--sx": `${particle.startX}vw`,
              "--sy": `${particle.startY}vh`,
              "--ex": `${particle.endX}vw`,
              "--ey": `${particle.endY}vh`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            } as CSSProperties & Record<string, string | number>;

            return (
              <span key={idx} className="splash-particle" style={style}>
                {particle.symbol}
              </span>
            );
          })}
        </div>
      )}

      <div className={`px-6 text-center ${transitionClassName} ${stateClassName}`}>
        <div className="relative inline-block overflow-hidden">
          <div
            className="bg-gradient-to-b from-[#D4AF37] to-[#F5D76E] bg-clip-text text-[min(24vw,260px)] leading-[0.92] tracking-tight text-transparent"
            style={{
              fontFamily: '"Georgia", "Times New Roman", serif',
              textShadow: "0 1px 0 rgba(255,244,204,0.24), 0 4px 10px rgba(0,0,0,0.2)",
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.18))",
            }}
          >
            MVS
          </div>
          {!reducedMotion && shineActive && (
            <span
              className="pointer-events-none absolute inset-y-0 left-[-30%] w-[36%] splash-shine-sweep"
              style={{
                background:
                  "linear-gradient(110deg, rgba(245,215,110,0) 0%, rgba(245,215,110,0.06) 38%, rgba(255,245,195,0.16) 50%, rgba(245,215,110,0.06) 62%, rgba(245,215,110,0) 100%)",
              }}
            />
          )}
        </div>
        <p className="mt-2 font-sans text-[10px] tracking-widest text-[var(--text-muted)] sm:text-[11px]">
          Most Valuable Student
        </p>
      </div>
    </div>
  );
}
