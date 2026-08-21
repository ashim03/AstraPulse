"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, List, KanbanSquare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { SmartTable, type SmartColumn, type SmartRow } from "@/components/app/smart-table";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { createTaskAction, updateTaskAction, updateTaskStatusAction, deleteTaskAction } from "./actions";

export type Option = { id: string; name: string };

export function TaskManager({
  rows,
  employees,
  departments,
}: {
  rows: SmartRow[];
  employees: Option[];
  departments: Option[];
}) {
  const [view, setView] = useState<"list" | "board">("list");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmartRow | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const { toast } = useToast();

  const columns: SmartColumn[] = [
    { key: "title", header: "Task", minWidth: 220 },
    { key: "assignee", header: "Assignee", kind: "avatar", avatarSubKey: "department" },
    { key: "priority", header: "Priority", kind: "badge", badgeMap: Object.fromEntries(TASK_PRIORITIES.map((p) => [p.value, { label: p.label, tone: p.tone as never }])) },
    { key: "status", header: "Status", kind: "status" },
    { key: "dueDate", header: "Due", kind: "date" },
  ];

  async function submit(fd: FormData) {
    setPending(true);
    const res = editing ? await updateTaskAction(String(editing.id), fd) : await createTaskAction(fd);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Saved", type: "success" });
      setOpen(false);
      setEditing(null);
      setErrors({});
      router.refresh();
    } else {
      setErrors(res.fieldErrors ?? {});
      toast({ title: res.error, type: "error" });
    }
  }

  async function moveStatus(id: string, status: string) {
    const res = await updateTaskStatusAction(id, status);
    if (res.ok) {
      toast({ title: res.message ?? "Done", type: "success" });
      router.refresh();
    } else {
      toast({ title: res.error, type: "error" });
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
          <button
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" /> List
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === "board" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            onClick={() => setView("board")}
          >
            <KanbanSquare className="h-4 w-4" /> Board
          </button>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setErrors({}); setOpen(true); }}>
          New Task
        </Button>
      </div>

      {view === "list" ? (
        <SmartTable
          rows={rows}
          columns={columns}
          rowKey="id"
          searchKeys={["title", "assignee", "description"]}
          searchPlaceholder="Search tasks..."
          filters={[{ key: "status", label: "Status", options: TASK_STATUSES }]}
          rowActions={[
            { label: "Edit", icon: <Pencil className="h-4 w-4" />, onClick: (r) => { setEditing(r); setErrors({}); setOpen(true); } },
            {
              label: "Complete",
              icon: <CheckIcon />,
              tone: "success",
              show: (r) => r.status !== "completed",
              onClick: (r) => moveStatus(String(r.id), "completed"),
            },
          ]}
          emptyTitle="No tasks"
          emptyDescription="Create a task to get started."
          exportFilename="tasks.csv"
          pageSize={10}
        />
      ) : (
        <TaskBoard rows={rows} onMove={moveStatus} />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Task" : "New Task"} description="Task details" size="lg">
        <form action={submit} className="space-y-4">
          <Input label="Title" name="title" defaultValue={String(editing?.title ?? "")} required error={errors.title} placeholder="e.g. Prepare Q3 report" />
          <Textarea label="Description" name="description" defaultValue={String(editing?.description ?? "")} rows={3} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Assignee" name="assigneeId" defaultValue={String(editing?.assigneeId ?? "")}>
              <option value="">Unassigned</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
            <Select label="Department" name="departmentId" defaultValue={String(editing?.departmentId ?? "")}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
            <Select label="Priority" name="priority" defaultValue={String(editing?.priority ?? "medium")}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
            <Input label="Due date" name="dueDate" type="date" defaultValue={String(editing?.dueDate ?? "")} />
          </div>
          {editing && (
            <Select label="Status" name="status" defaultValue={String(editing?.status ?? "todo")}>
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving..." : editing ? "Save Changes" : "Create Task"}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function CheckIcon() {
  return <Check className="h-4 w-4" />;
}

function TaskBoard({ rows, onMove }: { rows: SmartRow[]; onMove: (id: string, status: string) => void }) {
  const cols = ["backlog", "todo", "in_progress", "review", "completed"];
  const colLabel = (c: string) => c.replace("_", " ");
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cols.map((col) => {
        const items = rows.filter((r) => r.status === col);
        return (
          <div key={col} className="card flex flex-col p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold capitalize text-slate-700">{colLabel(col)}</h3>
              <Badge>{items.length}</Badge>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {items.map((t) => (
                <div key={String(t.id)} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                  <p className="text-sm font-medium text-slate-800">{String(t.title)}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{String(t.assignee ?? "Unassigned")}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <Badge tone={priorityTone(t.priority)}>{String(t.priority)}</Badge>
                    {t.dueDate ? <span className="text-xs text-slate-400">{String(t.dueDate)}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cols.map((c) =>
                      c === col ? null : (
                        <button key={c} onClick={() => onMove(String(t.id), c)} className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] capitalize text-slate-500 hover:bg-slate-50">
                          {colLabel(c)}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">No tasks</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function priorityTone(p: unknown) {
  return (TASK_PRIORITIES.find((x) => x.value === p)?.tone ?? "gray") as never;
}