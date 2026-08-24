import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}

export function FormActions({
  onCancel,
  cancelLabel = "Cancel",
  submitLabel = "Save changes",
  loading = false,
  children,
}: {
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
      {children}
      {!children && onCancel && (
        <button type="button" onClick={onCancel} className="btn-secondary">
          {cancelLabel}
        </button>
      )}
      {!children && (
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : submitLabel}
        </button>
      )}
    </div>
  );
}