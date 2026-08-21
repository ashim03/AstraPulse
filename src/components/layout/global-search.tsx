"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Command, X, ArrowRight } from "lucide-react";
import { NAVIGATION } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return NAVIGATION;
    return NAVIGATION.filter((n) => n.label.toLowerCase().includes(term));
  }, [query]);

  const goto = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-400 shadow-sm transition hover:border-slate-300 lg:w-72"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search anything…</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:flex">
          <Command className="h-2.5 w-2.5" /> K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-20">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-card border border-slate-200 bg-white shadow-modal animate-fade-in-scale">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search across the workspace…"
                className="flex-1 bg-transparent py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2 scrollbar-thin">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Pages
              </p>
              {results.map((r) => (
                <button
                  key={r.href}
                  onClick={() => goto(r.href)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    <r.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 font-medium">{r.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                </button>
              ))}
              {results.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-slate-400">
                  No results for "{query}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
      aria-label="Search"
    >
      <Search className="h-5 w-5" />
    </button>
  );
}