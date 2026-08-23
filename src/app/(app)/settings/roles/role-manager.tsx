"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Users, ChevronDown, ChevronRight, Plus, Trash2, Copy, Save, Check, X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmationDialog } from "@/components/ui/modal";
import {
  getRolesAction,
  updateRolePermissionsAction,
  createRoleAction,
  deleteRoleAction,
  type RoleData,
} from "./actions";
import { ALL_PERMISSIONS } from "@/lib/permissions";

const PERMISSION_CATEGORIES: Record<string, { label: string; permissions: string[] }> = {
  HR: {
    label: "HR & People",
    permissions: ALL_PERMISSIONS.filter((p) =>
      ["staff", "departments"].some((m) => p.startsWith(m + ":"))
    ),
  },
  Attendance: {
    label: "Attendance",
    permissions: ALL_PERMISSIONS.filter((p) => p.startsWith("attendance:")),
  },
  Leave: {
    label: "Leave & Holidays",
    permissions: ALL_PERMISSIONS.filter((p) =>
      ["leave", "holidays"].some((m) => p.startsWith(m + ":"))
    ),
  },
  Payroll: {
    label: "Payroll",
    permissions: ALL_PERMISSIONS.filter((p) => p.startsWith("payroll:")),
  },
  Finance: {
    label: "Finance & Accounting",
    permissions: ALL_PERMISSIONS.filter((p) =>
      ["expenses", "income", "accounting", "invoices", "payments"].some((m) =>
        p.startsWith(m + ":")
      )
    ),
  },
  Tasks: {
    label: "Tasks & Work",
    permissions: ALL_PERMISSIONS.filter((p) =>
      ["tasks", "work-records", "advances"].some((m) => p.startsWith(m + ":"))
    ),
  },
  Reports: {
    label: "Reports",
    permissions: ALL_PERMISSIONS.filter((p) =>
      ["reports", "analytics"].some((m) => p.startsWith(m + ":"))
    ),
  },
  Settings: {
    label: "Settings & System",
    permissions: ALL_PERMISSIONS.filter((p) =>
      ["settings", "audit-logs", "subscription"].some((m) => p.startsWith(m + ":"))
    ),
  },
  Users: {
    label: "Users & Roles",
    permissions: ALL_PERMISSIONS.filter((p) =>
      ["users", "roles", "dashboard"].some((m) => p.startsWith(m + ":"))
    ),
  },
  Communication: {
    label: "Communication",
    permissions: ALL_PERMISSIONS.filter((p) =>
      ["announcements", "mail"].some((m) => p.startsWith(m + ":"))
    ),
  },
};

function PermissionLabel(perm: string): string {
  const [module, action] = perm.split(":");
  const mod = module
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const act = action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `${mod}: ${act}`;
}

export function RoleManager({ initialRoles }: { initialRoles: RoleData[] }) {
  const [roles, setRoles] = useState<RoleData[]>(initialRoles);
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create role modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [copyFromRoleId, setCopyFromRoleId] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<RoleData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshRoles = useCallback(async () => {
    setLoading(true);
    const res = await getRolesAction();
    if (res.ok && res.data) {
      setRoles(res.data);
      if (selectedRole) {
        const updated = res.data.find((r) => r.id === selectedRole.id);
        if (updated) {
          setSelectedRole(updated);
          setEditPermissions(updated.permissions);
        }
      }
    }
    setLoading(false);
  }, [selectedRole]);

  const handleSelectRole = (role: RoleData) => {
    setSelectedRole(role);
    setEditPermissions([...role.permissions]);
    setExpandedCategories({});
  };

  const togglePermission = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const toggleCategoryAll = (categoryPerms: string[]) => {
    setEditPermissions((prev) => {
      const allSelected = categoryPerms.every((p) => prev.includes(p));
      if (allSelected) {
        return prev.filter((p) => !categoryPerms.includes(p));
      }
      const combined = new Set([...prev, ...categoryPerms]);
      return Array.from(combined);
    });
  };

  const toggleAllPermissions = () => {
    if (editPermissions.includes("*")) {
      setEditPermissions((prev) => prev.filter((p) => p !== "*"));
    } else {
      setEditPermissions(["*"]);
    }
  };

  const isCategoryFullySelected = (categoryPerms: string[]) =>
    categoryPerms.every((p) => editPermissions.includes(p));

  const isCategoryPartiallySelected = (categoryPerms: string[]) => {
    const selected = categoryPerms.filter((p) => editPermissions.includes(p));
    return selected.length > 0 && selected.length < categoryPerms.length;
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    const res = await updateRolePermissionsAction(selectedRole.id, editPermissions);
    setSaving(false);
    if (res.ok) {
      await refreshRoles();
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setCreating(true);
    const res = await createRoleAction(
      newRoleName.trim(),
      newRoleDescription.trim(),
      copyFromRoleId || undefined
    );
    setCreating(false);
    if (res.ok) {
      setShowCreateModal(false);
      setNewRoleName("");
      setNewRoleDescription("");
      setCopyFromRoleId("");
      await refreshRoles();
      if (res.data) {
        handleSelectRole(res.data);
      }
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteRoleAction(deleteTarget.id);
    setDeleting(false);
    if (res.ok) {
      setDeleteTarget(null);
      if (selectedRole?.id === deleteTarget.id) {
        setSelectedRole(null);
        setEditPermissions([]);
      }
      await refreshRoles();
    }
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Roles list */}
      <div className="space-y-4 lg:col-span-1">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Roles</h2>
          <Button size="sm" onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            New Role
          </Button>
        </div>

        <div className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleSelectRole(role)}
              className={`w-full text-left rounded-card border p-4 transition ${
                selectedRole?.id === role.id
                  ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20"
                  : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{role.name}</span>
                    {role.isSystem && (
                      <Badge tone="indigo" className="shrink-0">Default</Badge>
                    )}
                  </div>
                  {role.description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{role.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {role.userCount} user{role.userCount !== 1 ? "s" : ""}
                    </span>
                    <span>
                      {role.permissions.includes("*") ? "All permissions" : `${role.permissions.length} permissions`}
                    </span>
                  </div>
                </div>
                {!role.isSystem && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(role);
                    }}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    aria-label={`Delete ${role.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Permission editor */}
      <div className="lg:col-span-2">
        {selectedRole ? (
          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {selectedRole.name}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {selectedRole.description || "Configure permissions for this role"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleAllPermissions}
                >
                  {editPermissions.includes("*") ? "Clear All" : "Select All"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSavePermissions}
                  loading={saving}
                  leftIcon={<Save className="h-4 w-4" />}
                >
                  Save
                </Button>
              </div>
            </div>
            <CardBody className="space-y-4">
              {Object.entries(PERMISSION_CATEGORIES).map(([key, category]) => {
                const expanded = expandedCategories[key] ?? true;
                const fullySelected = isCategoryFullySelected(category.permissions);
                const partiallySelected = isCategoryPartiallySelected(category.permissions);

                return (
                  <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => toggleCategory(key)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="flex items-center gap-3">
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {category.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {category.permissions.filter((p) => editPermissions.includes(p)).length}/{category.permissions.length}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategoryAll(category.permissions);
                        }}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                          fullySelected
                            ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                            : partiallySelected
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {fullySelected ? "All" : partiallySelected ? "Some" : "None"}
                      </button>
                    </button>
                    {expanded && (
                      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {category.permissions.map((perm) => {
                            const checked = editPermissions.includes(perm);
                            return (
                              <label
                                key={perm}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition cursor-pointer ${
                                  checked
                                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/50"
                                }`}
                              >
                                <div
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                    checked
                                      ? "border-brand-600 bg-brand-600 dark:border-brand-500 dark:bg-brand-500"
                                      : "border-slate-300 dark:border-slate-600"
                                  }`}
                                >
                                  {checked && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={checked}
                                  onChange={() => togglePermission(perm)}
                                />
                                <span className="truncate">{PermissionLabel(perm)}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                Select a role to edit its permissions
              </p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Click on a role card to configure its access
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Create Role Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Role"
        description="Define a new role and optionally copy permissions from an existing role."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRole} loading={creating} leftIcon={<Plus className="h-4 w-4" />}>
              Create Role
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Role Name
            </label>
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g. Office Manager"
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              placeholder="Brief description of this role"
              rows={2}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Copy Permissions From <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <select
              value={copyFromRoleId}
              onChange={(e) => setCopyFromRoleId(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400"
            >
              <option value="">Start from scratch</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.permissions.includes("*") ? "All" : r.permissions.length} permissions)
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteRole}
        title={`Delete "${deleteTarget?.name}"?`}
        description={
          deleteTarget?.userCount
            ? `This role has ${deleteTarget.userCount} user(s) assigned. Reassign them before deleting.`
            : "This action cannot be undone. The role will be permanently removed."
        }
        confirmLabel={deleteTarget?.userCount ? "Cannot Delete" : "Delete Role"}
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}
