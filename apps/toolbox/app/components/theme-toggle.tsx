"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@numera/ui";

const OPTIONS = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
];

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();

  if (collapsed) {
    const currentIndex = Math.max(
      0,
      OPTIONS.findIndex((o) => o.value === theme),
    );
    const current = OPTIONS[currentIndex];
    const next = OPTIONS[(currentIndex + 1) % OPTIONS.length];
    const NextIcon = next.icon;
    return (
      <button
        onClick={() => setTheme(next.value)}
        title={`Switch to ${next.label} theme`}
        aria-label={`Switch to ${next.label} theme. Currently ${current.label}.`}
        className={cn(
          "flex items-center justify-center rounded-md p-2",
          "text-[var(--muted-foreground)] hover:bg-slate-100 hover:text-[var(--foreground)]",
          "transition-colors duration-150",
        )}
      >
        <NextIcon size={20} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-[var(--border)] p-0.5">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            "rounded p-1.5 transition-colors duration-150",
            theme === value
              ? "bg-[var(--accent)] text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
