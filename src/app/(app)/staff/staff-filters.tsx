"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Filter } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function StaffFilters({
  departments,
}: {
  departments: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const letter = params.get("letter") || "";
  const search = params.get("search") || "";
  const department = params.get("department") || "";
  const employmentType = params.get("employmentType") || "";
  const status = params.get("status") || "";
  const gender = params.get("gender") || "";
  const sortBy = params.get("sortBy") || "name";
  const sortOrder = params.get("sortOrder") || "asc";

  const activeFilterCount = [letter, department, employmentType, status, gender].filter(Boolean).length;

  const setParam = useCallback(
    (key: string, value: string) => {
      const sp = new URLSearchParams(params.toString());
      if (value) {
        sp.set(key, value);
      } else {
        sp.delete(key);
      }
      router.push(`?${sp.toString()}`, { scroll: false });
    },
    [router, params]
  );

  const clearAll = useCallback(() => {
    router.push("/staff", { scroll: false });
  }, [router]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
        <button
          onClick={() => setParam("letter", "")}
          className={`flex h-8 min-h-[32px] w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium transition ${
            !letter
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          }`}
        >
          All
        </button>
        {ALPHABET.map((l) => (
          <button
            key={l}
            onClick={() => setParam("letter", letter === l ? "" : l)}
            className={`flex h-8 min-h-[32px] w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium transition ${
              letter === l
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Input
            leftIcon={<Search className="h-4 w-4" />}
            placeholder="Search by name, ID, email..."
            value={search}
            onChange={(e) => setParam("search", e.target.value)}
            className="min-h-[44px]"
          />
        </div>

        <Select value={department} onChange={(e) => setParam("department", e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>

        <Select value={employmentType} onChange={(e) => setParam("employmentType", e.target.value)}>
          <option value="">All Types</option>
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
          <option value="probation">Probation</option>
        </Select>

        <Select value={status} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="terminated">Terminated</option>
          <option value="inactive">Inactive</option>
        </Select>

        <Select value={gender} onChange={(e) => setParam("gender", e.target.value)}>
          <option value="">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Sort:</label>
          <Select
            value={sortBy}
            onChange={(e) => setParam("sortBy", e.target.value)}
            className="w-auto min-h-[36px]"
          >
            <option value="name">Name</option>
            <option value="joinDate">Joining Date</option>
            <option value="baseSalary">Salary</option>
          </Select>
          <button
            onClick={() => setParam("sortOrder", sortOrder === "asc" ? "desc" : "asc")}
            className="flex h-9 min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        </div>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="h-3.5 w-3.5 mr-1" />
            Clear Filters
            <Badge tone="blue" className="ml-1.5">
              {activeFilterCount}
            </Badge>
          </Button>
        )}
      </div>
    </div>
  );
}
