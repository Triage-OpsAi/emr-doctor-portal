"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";
type ThemeValue = { theme: Theme; toggleTheme: () => void };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("meridian_doctor_theme") as Theme | null;
    const next = saved === "light" ? "light" : "dark";
    // Synchronize the persisted browser preference after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () =>
        setTheme((current) => {
          const next = current === "dark" ? "light" : "dark";
          localStorage.setItem("meridian_doctor_theme", next);
          document.documentElement.dataset.theme = next;
          return next;
        }),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const light = theme === "light";
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--muted)]">
      <span className="hidden sm:inline">{light ? "Light" : "Dark"}</span>
      <input
        className="sr-only peer"
        type="checkbox"
        checked={light}
        onChange={toggleTheme}
        aria-label="Toggle light and dark theme"
      />
      <span className="relative w-11 h-6 rounded-full bg-[var(--ink-panel)] border border-[var(--border)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--signal)]">
        <span
          className={`absolute top-[3px] w-4 h-4 rounded-full bg-[var(--teal)] transition-transform ${
            light ? "translate-x-[23px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </label>
  );
}
