"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getTodayIsoDate } from "@/lib/date-utils";

interface ExportButtonProps {
  exportToCSV: () => string;
  disabled?: boolean;
  size?: React.ComponentProps<typeof Button>["size"];
}

export function ExportButton({
  exportToCSV,
  disabled,
  size = "default",
}: ExportButtonProps) {
  const handleExport = useCallback(() => {
    const csv = exportToCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fencing-data-${getTodayIsoDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exportToCSV]);

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleExport}
      disabled={disabled}
    >
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
}
