"use client";

import { forwardRef } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

export const CurrencyInput = forwardRef<HTMLInputElement, {
  value: number | string;
  onChangeValue: (v: number) => void;
  currency?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: number;
}>(function CurrencyInput({ value, onChangeValue, currency = "NPR", className, ...props }, ref) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
        {currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : currency === "NPR" ? "Rs." : currency}
      </span>
      <Input
        ref={ref}
        type="number"
        step="0.01"
        inputMode="decimal"
        value={value === 0 ? "" : value}
        onChange={(e) => onChangeValue(parseFloat(e.target.value) || 0)}
        className={cn("pl-8 text-right font-medium", className)}
        {...props}
      />
    </div>
  );
});

export const NumberInput = forwardRef<HTMLInputElement, {
  value: number | string;
  onChangeValue: (v: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: number;
  step?: number;
}>(function NumberInput({ value, onChangeValue, className, step = 1, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="number"
      step={step}
      inputMode="decimal"
      value={value === 0 ? "" : value}
      onChange={(e) => onChangeValue(parseFloat(e.target.value) || 0)}
      className={cn("text-right font-medium", className)}
      {...props}
    />
  );
});