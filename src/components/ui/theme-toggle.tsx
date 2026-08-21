"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button className={cn("rounded-md p-2 text-slate-500", className)} disabled>
        <Monitor className="h-5 w-5" />
      </button>
    );
  }

  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <button
      onClick={cycle}
      className={cn(
        "rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700",
        "dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200",
        className
      )}
      aria-label={`Theme: ${theme}. Click to cycle.`}
      title={`Current: ${theme}`}
    >
      {theme === "light" && <Sun className="h-5 w-5" />}
      {theme === "dark" && <Moon className="h-5 w-5" />}
      {theme === "system" && <Monitor className="h-5 w-5" />}
    </button>
  );
}
