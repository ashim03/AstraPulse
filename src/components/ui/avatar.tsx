import { cn, initials } from "@/lib/utils";

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

const tones = [
  "bg-indigo-100 text-indigo-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
];

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const toneIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % tones.length;
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover ring-1 ring-slate-200", sizes[size], className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold",
        sizes[size],
        tones[toneIndex],
        className
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}

export function AvatarGroup({ users, max = 4, size = "sm" }: { users: string[]; max?: number; size?: keyof typeof sizes }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((name, i) => (
        <Avatar key={`${name}-${i}`} name={name} size={size} className="ring-2 ring-white" />
      ))}
      {extra > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-slate-100 font-medium text-slate-600 ring-2 ring-white",
            sizes[size]
          )}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}