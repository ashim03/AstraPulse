import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max = 100,
  tone = "indigo",
  size = "md",
  label,
  className,
}: {
  value: number;
  max?: number;
  tone?: "indigo" | "green" | "amber" | "red" | "sky";
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const tones = {
    indigo: "bg-brand-600",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    sky: "bg-sky-500",
  };
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">{label}</span>
          <span className="text-slate-400">{pct.toFixed(0)}%</span>
        </div>
      )}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-slate-100",
          size === "sm" ? "h-1.5" : "h-2.5"
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", tones[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  active && "border-brand-600 bg-brand-600 text-white",
                  !done && !active && "border-slate-300 bg-white text-slate-400"
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  active ? "text-slate-900" : done ? "text-emerald-700" : "text-slate-400"
                )}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("mx-2 h-px flex-1", i < current ? "bg-emerald-400" : "bg-slate-200")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}