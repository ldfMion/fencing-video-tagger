"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportButtonProps {
  exportToCSV: () => string;
  disabled?: boolean;
}

export function ExportButton({ exportToCSV, disabled }: ExportButtonProps) {
  const handleExport = useCallback(() => {
    const csv = exportToCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    link.href = url;
    link.download = `fencing-data-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exportToCSV]);

  return (
    <Button variant="outline" onClick={handleExport} disabled={disabled}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
}
