"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorageEnvelopeSchema } from "@/lib/types";
import { useSessions } from "@/hooks/use-sessions";

export function ImportButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { importSessions } = useSessions();

  function handleClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const result = StorageEnvelopeSchema.safeParse(json);
      if (!result.success) {
        setStatus("Invalid file format. Expected a valid import JSON file.");
        return;
      }

      const { imported, skipped } = importSessions(result.data.sessions);
      setStatus(
        `Imported ${imported} bout${imported !== 1 ? "s" : ""}` +
          (skipped > 0
            ? `, skipped ${skipped} duplicate${skipped !== 1 ? "s" : ""}`
            : "")
      );
    } catch {
      setStatus("Failed to read or parse the file.");
    }

    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleClick}>
        <Upload className="h-4 w-4 mr-1" />
        Import JSON
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
      {status && (
        <span className="text-xs text-muted-foreground">{status}</span>
      )}
    </div>
  );
}
