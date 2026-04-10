"use client";

import { useCallback, useState } from "react";
import { ChevronDown, Download, FileJson, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getTodayIsoDate } from "@/lib/date-utils";

interface ExportMenuButtonProps {
  exportAllToJson: () => string;
  exportAllToNormalizedCsvZip: () => Promise<Blob>;
  disabled?: boolean;
}

interface BoutExportButtonProps {
  exportBoutToCsv: () => string;
  fileName: string;
  disabled?: boolean;
  size?: React.ComponentProps<typeof Button>["size"];
}

function triggerDownload(fileName: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ExportMenuButton({
  exportAllToJson,
  exportAllToNormalizedCsvZip,
  disabled,
}: ExportMenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  const handleJsonExport = useCallback(() => {
    triggerDownload(
      `fencing-sessions-${getTodayIsoDate()}.json`,
      exportAllToJson(),
      "application/json;charset=utf-8",
    );
    setIsOpen(false);
  }, [exportAllToJson]);

  const handleZipExport = useCallback(async () => {
    setIsExportingZip(true);

    try {
      const zipBlob = await exportAllToNormalizedCsvZip();
      triggerDownload(
        `fencing-data-${getTodayIsoDate()}.zip`,
        zipBlob,
        "application/zip",
      );
      setIsOpen(false);
    } finally {
      setIsExportingZip(false);
    }
  }, [exportAllToNormalizedCsvZip]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || isExportingZip}>
          <Download className="mr-1.5 h-4 w-4" />
          Export
          <ChevronDown className="ml-1.5 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        <PopoverHeader className="px-2 py-1">
          <PopoverTitle>Export Data</PopoverTitle>
        </PopoverHeader>
        <Button
          variant="ghost"
          className="justify-start"
          onClick={handleJsonExport}
        >
          <FileJson className="mr-2 h-4 w-4" />
          Export All JSON
        </Button>
        <Button
          variant="ghost"
          className="justify-start"
          onClick={() => {
            void handleZipExport();
          }}
          disabled={isExportingZip}
        >
          <Table className="mr-2 h-4 w-4" />
          {isExportingZip ? "Building ZIP..." : "Export All CSV ZIP"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function BoutExportButton({
  exportBoutToCsv,
  fileName,
  disabled,
  size = "default",
}: BoutExportButtonProps) {
  const handleExport = useCallback(() => {
    triggerDownload(
      fileName,
      exportBoutToCsv(),
      "text/csv;charset=utf-8",
    );
  }, [exportBoutToCsv, fileName]);

  return (
    <Button
      variant="outline"
      size={size}
      onClick={handleExport}
      disabled={disabled}
    >
      <Download className="mr-2 h-4 w-4" />
      Export Bout CSV
    </Button>
  );
}
