"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function Dropdown({
  trigger,
  children,
  align = "right",
  width = "w-56",
  className,
}: {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "left" | "right";
  width?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const onUp = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !portalRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, []);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const isRight = align === "right";
    setCoords({
      top: rect.bottom + 6,
      left: isRight ? rect.right : rect.left,
    });
  }, [open, align]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open &&
        coords &&
        createPortal(
          <div
            ref={portalRef}
            className={cn(
              "fixed z-50 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-popover animate-fade-in-scale dark:border-slate-700 dark:bg-slate-800",
              width,
              className
            )}
            style={{ top: coords.top, left: align === "right" ? undefined : coords.left, right: align === "right" ? window.innerWidth - coords.left : undefined }}
          >
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </div>,
          document.body
        )}
    </div>
  );
}

export function DropdownItem({
  icon,
  children,
  onClick,
  danger,
  disabled,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50",
        danger ? "text-red-600" : "text-slate-700"
      )}
    >
      {icon && <span className="text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-slate-100" />;
}