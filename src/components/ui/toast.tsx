"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";
type Toast = { id: number; type: ToastType; title: string; description?: string };

const ToastContext = createContext<{ toast: (t: Omit<Toast, "id">) => void }>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  info: <Info className="h-5 w-5 text-sky-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-modal animate-fade-in-scale"
                role="status"
              >
                <div className="mt-0.5 shrink-0">{icons[t.type]}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-sm text-slate-500">{t.description}</p>}
                </div>
                <button
                  onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                  className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function toastClass(type: ToastType) {
  return cn(
    "rounded-lg px-2.5 py-1.5 text-xs font-semibold",
    type === "success" && "bg-emerald-50 text-emerald-700",
    type === "error" && "bg-red-50 text-red-700",
    type === "warning" && "bg-amber-50 text-amber-800",
    type === "info" && "bg-sky-50 text-sky-700"
  );
}