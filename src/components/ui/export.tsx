"use client";

import { type ReactNode } from "react";
import { Download, Printer, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "./button";
import { Dropdown, DropdownItem, DropdownSeparator } from "./dropdown";

export function printView() {
  window.print();
}

export function PrintButton({ label = "Print", className }: { label?: string; className?: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={() => printView()} className={className} leftIcon={<Printer className="h-4 w-4" />}>
      {label}
    </Button>
  );
}

export function ExportMenu({
  onCsv,
  onExcel,
  onPdf,
  label = "Export",
}: {
  onCsv?: () => void;
  onExcel?: () => void;
  onPdf?: () => void;
  label?: string;
}) {
  return (
    <Dropdown
      trigger={
        <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />}>
          {label}
        </Button>
      }
    >
      {(close) => (
        <>
          {onCsv && (
            <DropdownItem
              icon={<FileSpreadsheet className="h-4 w-4" />}
              onClick={() => {
                close();
                onCsv();
              }}
            >
              Export as CSV
            </DropdownItem>
          )}
          {onExcel && (
            <DropdownItem
              icon={<FileSpreadsheet className="h-4 w-4" />}
              onClick={() => {
                close();
                onExcel();
              }}
            >
              Export as Excel
            </DropdownItem>
          )}
          {onPdf && (
            <DropdownItem
              icon={<FileText className="h-4 w-4" />}
              onClick={() => {
                close();
                onPdf();
              }}
            >
              Export as PDF
            </DropdownItem>
          )}
        </>
      )}
    </Dropdown>
  );
}

export function ExportableHeader({ onExport, printLabel = "Print" }: { onExport?: () => void; printLabel?: string }) {
  return (
    <div className="flex items-center gap-2">
      {onExport && <ExportMenu onCsv={onExport} onExcel={onExport} />}
      <PrintButton label={printLabel} />
    </div>
  );
}

export function TableExportButton({ onClick, label = "Export" }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} leftIcon={<Download className="h-4 w-4" />}>
      {label}
    </Button>
  );
}

export type { ReactNode };