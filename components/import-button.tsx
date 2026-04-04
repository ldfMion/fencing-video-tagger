"use client";

import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseStoredSessionsFromRaw,
  SESSION_MIGRATION_FLAG_KEY,
  SESSION_STORAGE_KEY,
} from "@/lib/session-service";
import { StorageEnvelopeSchema } from "@/lib/types";
import { useSessions } from "@/hooks/use-sessions";

const MIGRATION_COMPLETED_VALUE = "completed";
const MIGRATION_DISMISSED_VALUE = "dismissed";

export function ImportButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [migrationSessions, setMigrationSessions] = useState<
    ReturnType<typeof parseStoredSessionsFromRaw>["sessions"]
  >([]);
  const [isMigrationDialogOpen, setIsMigrationDialogOpen] = useState(false);
  const { importSessions, sessions, status: queryStatus } = useSessions();

  function handleClick() {
    fileInputRef.current?.click();
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (queryStatus === "pending" || sessions.length > 0) {
      return;
    }

    const migrationFlag = window.localStorage.getItem(SESSION_MIGRATION_FLAG_KEY);

    if (
      migrationFlag === MIGRATION_COMPLETED_VALUE ||
      migrationFlag === MIGRATION_DISMISSED_VALUE
    ) {
      return;
    }

    const storedValue = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!storedValue) {
      return;
    }

    try {
      const parsed = parseStoredSessionsFromRaw(JSON.parse(storedValue));

      if (parsed.sessions.length === 0) {
        return;
      }

      setMigrationSessions(parsed.sessions);
      setIsMigrationDialogOpen(true);
    } catch {
      // Ignore unreadable legacy data and avoid blocking the current server-backed flow.
    }
  }, [queryStatus, sessions.length]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsImporting(true);
      const text = await file.text();
      const json = JSON.parse(text);

      const result = StorageEnvelopeSchema.safeParse(json);
      if (!result.success) {
        setStatusMessage("Invalid file format. Expected a valid import JSON file.");
        return;
      }

      const { imported, skipped } = await importSessions(result.data.sessions);
      setStatusMessage(
        `Imported ${imported} bout${imported !== 1 ? "s" : ""}` +
          (skipped > 0
            ? `, skipped ${skipped} duplicate${skipped !== 1 ? "s" : ""}`
            : ""),
      );
    } catch {
      setStatusMessage("Failed to read or parse the file.");
    } finally {
      setIsImporting(false);
    }

    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  async function handleMigrationImport() {
    if (typeof window === "undefined" || migrationSessions.length === 0) {
      return;
    }

    try {
      setIsImporting(true);
      const { imported, skipped } = await importSessions(migrationSessions);
      window.localStorage.setItem(
        SESSION_MIGRATION_FLAG_KEY,
        MIGRATION_COMPLETED_VALUE,
      );
      setStatusMessage(
        `Migrated ${imported} bout${imported !== 1 ? "s" : ""}` +
          (skipped > 0
            ? `, skipped ${skipped} duplicate${skipped !== 1 ? "s" : ""}`
            : ""),
      );
      setIsMigrationDialogOpen(false);
    } catch {
      setStatusMessage("Failed to migrate local browser data.");
    } finally {
      setIsImporting(false);
    }
  }

  function handleMigrationDismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        SESSION_MIGRATION_FLAG_KEY,
        MIGRATION_DISMISSED_VALUE,
      );
    }

    setIsMigrationDialogOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={isImporting}
        >
          <Upload className="mr-1 h-4 w-4" />
          Import JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
        {statusMessage ? (
          <span className="text-xs text-muted-foreground">{statusMessage}</span>
        ) : null}
      </div>

      <Dialog
        open={isMigrationDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleMigrationDismiss();
            return;
          }

          setIsMigrationDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Migrate local browser sessions?</DialogTitle>
            <DialogDescription>
              The server store is empty, but this browser still has{" "}
              {migrationSessions.length} saved bout
              {migrationSessions.length !== 1 ? "s" : ""} from the old
              localStorage flow. Import them into the new server-backed store?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleMigrationDismiss}
              disabled={isImporting}
            >
              Dismiss
            </Button>
            <Button
              type="button"
              onClick={handleMigrationImport}
              disabled={isImporting}
            >
              Import Sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
