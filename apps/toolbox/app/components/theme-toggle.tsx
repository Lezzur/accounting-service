"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "./theme-provider";
import { cn } from "@numera/ui";

const OPTIONS = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "System" },
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
    const CurrentIcon = current.icon;
    return (
      <button
        onClick={() => setTheme(next.value)}
        title={`Theme: ${current.label} (click for ${next.label})`}
        aria-label={`Theme: ${current.label}. Click to switch to ${next.label}.`}
        className={cn(
          "flex items-center justify-center rounded-md p-2",
          "text-[var(--muted-foreground)] hover:bg-slate-100 hover:text-[var(--foreground)]",
          "transition-colors duration-150",
        )}
      >
        <CurrentIcon size={20} />
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
