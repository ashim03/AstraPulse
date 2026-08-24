"use client";

import { useState, useRef } from "react";
import { Camera, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { uploadAvatarAction } from "@/app/(app)/settings/actions";

export function EmployeeAvatarUpload({
  currentAvatar,
  name,
}: {
  currentAvatar?: string | null;
  name: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatar ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large (max 2MB)", type: "error" });
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const res = await uploadAvatarAction(fd);
      if (res.ok) {
        toast({ title: "Photo updated", type: "success" });
        setPreview(URL.createObjectURL(file));
      } else {
        toast({ title: res.error, type: "error" });
      }
    } catch {
      toast({ title: "Upload failed", type: "error" });
    }
    setUploading(false);
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        {preview ? (
          <img src={preview} alt={name} className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-400">
            {initials}
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-800 dark:ring-slate-600"
        >
          <Camera className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>
      <div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <Button type="button" variant="secondary" size="sm" leftIcon={<Camera className="h-4 w-4" />} loading={uploading} onClick={() => fileRef.current?.click()}>
          Change photo
        </Button>
        <p className="mt-1 text-xs text-slate-400">JPG, PNG up to 2MB</p>
      </div>
    </div>
  );
}
