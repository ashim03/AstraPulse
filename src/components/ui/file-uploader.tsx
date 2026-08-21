"use client";

import { useRef, useState, type ReactNode } from "react";
import { UploadCloud, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileUploader({
  value,
  onChange,
  accept,
  label,
  hint,
  multiple,
  className,
}: {
  value?: string | null;
  onChange?: (fileName: string) => void;
  accept?: string;
  label?: string;
  hint?: string;
  multiple?: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setFileName(file.name);
            onChange?.(file.name);
          }
        }}
      />
      {fileName || value ? (
        <div className="flex items-center gap-3 rounded-input border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
            <FileText className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{fileName ?? value}</span>
          <button
            onClick={() => {
              setFileName(null);
              onChange?.("");
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-input border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center transition hover:border-brand-300 hover:bg-brand-50/40"
        >
          <UploadCloud className="h-6 w-6 text-slate-400" />
          <div className="text-sm">
            <span className="font-medium text-brand-700">{label ?? "Click to upload"}</span>
            <span className="text-slate-400"> or drag & drop</span>
          </div>
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </button>
      )}
    </div>
  );
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  className,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex min-h-[38px] items-center justify-between gap-2 text-left"
      >
        <span className="flex flex-wrap gap-1">
          {value.length === 0 && <span className="text-slate-400">{placeholder}</span>}
          {value.map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span key={v} className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                {opt?.label ?? v}
                <button type="button" onClick={() => onChange(value.filter((x) => x !== v))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-popover scrollbar-thin">
          {options.map((o) => {
            const checked = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])
                }
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded border", checked ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300")}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { Check } from "lucide-react";