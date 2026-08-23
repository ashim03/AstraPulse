import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let currencyFormatter: Intl.NumberFormat | null = null;
let numberFormatter: Intl.NumberFormat | null = null;

export function setLocale(currency = "NPR", locale = "en-US") {
  currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  numberFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  });
}

export function money(value: number | null | undefined, currency = "NPR"): string {
  const v = value ?? 0;
  return (currencyFormatter ?? new Intl.NumberFormat("en-US", { style: "currency", currency })).format(v);
}

export function num(value: number | null | undefined): string {
  const v = value ?? 0;
  return (numberFormatter ?? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })).format(v);
}

export function formatDate(value: Date | string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  return format(d, pattern);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  return format(d, "MMM d, yyyy h:mm a");
}

export function timeAgo(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function initials(name: string): string {
  return String(name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function padNumber(num: number, width = 4): string {
  return String(Math.floor(num)).padStart(width, "0");
}

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isWeekend(date: Date, weekendDays: number[] = [0, 6]): boolean {
  const day = date.getDay();
  return weekendDays.includes(day);
}

export function isNepalWeekend(date: Date): boolean {
  // In Nepal, Saturday (6) is typically off, Sunday (0) may vary by company
  // Default: Saturday is off (day 6)
  return date.getDay() === 6;
}

export function getNepalWeekendDays(): number[] {
  return [6]; // Saturday
}

export function formatNepaliDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kathmandu",
  };
  return new Intl.DateTimeFormat("ne-NP", options).format(date);
}

export function formatDateTimeNepal(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d).replace(",", "");
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const escape = (cell: string | number) => {
    const s = String(cell ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

const toNum = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function sum(items: unknown[], key?: string): number {
  if (key) {
    return items.reduce<number>((acc, item) => {
      const v = item && typeof item === "object" ? (item as Record<string, unknown>)[key] : undefined;
      return acc + toNum(v);
    }, 0);
  }
  return items.reduce<number>((acc, v) => acc + toNum(v), 0);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}