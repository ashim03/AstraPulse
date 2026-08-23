"use client";

import { useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export function OtpInput({ length = 6, value, onChange, disabled, error, className }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback(
    (index: number) => {
      if (index >= 0 && index < length) {
        inputRefs.current[index]?.focus();
        inputRefs.current[index]?.select();
      }
    },
    [length]
  );

  const handleChange = useCallback(
    (index: number, digit: string) => {
      if (disabled) return;
      const clean = digit.replace(/\D/g, "").slice(-1);
      const chars = value.split("");
      while (chars.length < length) chars.push("");
      chars[index] = clean;
      const newValue = chars.join("").slice(0, length);
      onChange(newValue);
      if (clean && index < length - 1) {
        focusInput(index + 1);
      }
    },
    [value, onChange, focusInput, disabled, length]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        const chars = value.split("");
        if (chars[index]) {
          chars[index] = "";
          onChange(chars.join(""));
        } else if (index > 0) {
          chars[index - 1] = "";
          onChange(chars.join(""));
          focusInput(index - 1);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusInput(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        focusInput(index + 1);
      }
    },
    [value, onChange, focusInput, disabled]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      if (pasted) {
        onChange(pasted.padEnd(length, ""));
        focusInput(Math.min(pasted.length, length - 1));
      }
    },
    [onChange, focusInput, disabled, length]
  );

  const chars = value.split("");
  while (chars.length < length) chars.push("");

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={chars[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={cn(
            "h-12 w-10 rounded-lg border bg-white text-center text-lg font-semibold",
            "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
            "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none",
            "transition-colors",
            error
              ? "border-red-300 dark:border-red-500"
              : chars[i]
              ? "border-brand-400 dark:border-brand-500"
              : "border-slate-300",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}
