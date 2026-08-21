"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { FormSection, FormGrid, FormActions } from "@/components/ui/form";
import { Input, Select, Textarea, FieldError } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions";
import { EMPLOYMENT_TYPES } from "@/lib/constants";
import { createEmployeeAction, updateEmployeeAction } from "./actions";

export type EmployeeFormData = {
  id?: string;
  name: string;
  email: string;
  employeeId?: string;
  phone?: string;
  departmentId?: string;
  positionId?: string;
  employmentType?: string;
  baseSalary?: number;
  joinDate?: string;
  contractEndDate?: string;
  status?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  taxId?: string;
  bankName?: string;
  bankAccountNumber?: string;
};

export function EmployeeForm({
  initial,
  departments,
  positions,
  isEdit,
}: {
  initial: EmployeeFormData;
  departments: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string }>;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res: ActionResult = isEdit
      ? await updateEmployeeAction(initial.id!, fd)
      : await createEmployeeAction(fd);
    setPending(false);
    if (res.ok) {
      toast({ title: res.message ?? "Saved", type: "success" });
      router.push("/staff");
      router.refresh();
    } else {
      setFieldErrors(res.fieldErrors ?? {});
      toast({ title: res.error, type: "error" });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title="Personal Information" description="Basic details about the employee">
        <FormGrid>
          <div>
            <Input label="Full name" name="name" defaultValue={initial.name} required error={fieldErrors.name} />
          </div>
          <div>
            <Input label="Work email" name="email" type="email" defaultValue={initial.email} required error={fieldErrors.email} />
          </div>
          <div>
            <Input label="Phone" name="phone" defaultValue={initial.phone ?? ""} />
          </div>
          <div>
            <Input label="Employee ID" name="employeeId" defaultValue={initial.employeeId ?? ""} placeholder="Auto-generated if blank" />
          </div>
          <div>
            <Input label="Date of birth" name="dateOfBirth" type="date" max={today} defaultValue={initial.dateOfBirth ?? ""} />
          </div>
          <div>
            <Select label="Gender" name="gender" defaultValue={initial.gender ?? ""}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </FormGrid>
      </FormSection>

      <FormSection title="Employment" description="Role, department and compensation">
        <FormGrid>
          <div>
            <Select label="Department" name="departmentId" defaultValue={initial.departmentId ?? ""}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Select label="Position" name="positionId" defaultValue={initial.positionId ?? ""}>
              <option value="">—</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </div>
          <div>
            <Select label="Employment type" name="employmentType" defaultValue={initial.employmentType ?? "full_time"}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </Select>
          </div>
          <div>
            <Select label="Status" name="status" defaultValue={initial.status ?? "active"}>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="terminated">Terminated</option>
            </Select>
          </div>
          <div>
            <Input label="Annual salary" name="salary" type="number" min={0} defaultValue={initial.baseSalary ?? 0} />
          </div>
          <div>
            <Input label="Hire date" name="hireDate" type="date" defaultValue={initial.joinDate ?? ""} />
          </div>
          <div>
            <Input label="Contract end date" name="contractEndDate" type="date" defaultValue={initial.contractEndDate ?? ""} />
          </div>
        </FormGrid>
      </FormSection>

      <FormSection title="Contact & Emergency" description="Additional contact information">
        <FormGrid>
          <div className="sm:col-span-2">
            <Input label="Address" name="address" defaultValue={initial.address ?? ""} />
          </div>
          <div>
            <Input label="Emergency contact name" name="emergencyContactName" defaultValue={initial.emergencyName ?? ""} />
          </div>
          <div>
            <Input label="Emergency contact phone" name="emergencyContactPhone" defaultValue={initial.emergencyPhone ?? ""} />
          </div>
          <div>
            <Input label="National ID" name="nationalId" defaultValue={initial.taxId ?? ""} />
          </div>
        </FormGrid>
      </FormSection>

      {!isEdit && (
        <FormSection title="Bank Details" description="Used for payroll disbursement">
          <FormGrid>
            <div>
              <Input label="Bank name" name="bankName" defaultValue={initial.bankName ?? ""} />
            </div>
            <div>
              <Input label="Account number" name="accountNumber" defaultValue={initial.bankAccountNumber ?? ""} />
            </div>
          </FormGrid>
          <p className="mt-3 text-xs text-slate-400">
            A login account will be created for this employee with a default password of <code className="rounded bg-slate-100 px-1">Change@123</code>. They can reset it on first login.
          </p>
        </FormSection>
      )}

      <FormActions>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving..." : isEdit ? "Save Changes" : "Add Employee"}</Button>
      </FormActions>
    </form>
  );
}