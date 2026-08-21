"use client";

import { type ReactNode } from "react";
import { Card, CardHeader } from "./card";

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
  height = 280,
  loading,
  skeleton,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  height?: number;
  loading?: boolean;
  skeleton?: ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <div className="p-4">
        {loading && skeleton ? (
          skeleton
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </div>
    </Card>
  );
}