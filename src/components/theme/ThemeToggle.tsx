"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function applyTheme(nextTheme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", nextTheme === "dark");
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    const initialTheme: Theme = saved === "light" ? "light" : "dark";
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-xl border px-3 py-2 text-xs font-medium"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
