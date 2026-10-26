"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Copy, Loader2, Square, SquareTerminal } from "lucide-react";
import { AutoTagReport } from "@/components/auto-tag-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAutoTagJob } from "@/hooks/use-auto-tag-job";
import {
  formatAutoTagJobStatus,
  isAutoTagJobActive,
  type AutoTagJobView,
} from "@/lib/auto-tag/job";
import { isMatchClockEnabled, isStripZoneEnabled } from "@/lib/tagging";
import type { VideoSession } from "@/lib/types";

interface AutoTagDialogProps {
  session: VideoSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoTagDialog({ session, open, onOpenChange }: AutoTagDialogProps) {
  const autoTag = useAutoTagJob(session.id);
  const job = autoTag.job;
  const isJobActive = job !== null && isAutoTagJobActive(job.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="size-4" />
            Auto-tag with Codex
          </DialogTitle>
          <DialogDescription>
            Codex scans frames of the attached video and saves each awarded touch as it goes.
            Its tags are marked as agent-made.
          </DialogDescription>
        </DialogHeader>

        {isJobActive ? (
          <ActiveJobPanel job={job} autoTag={autoTag} />
        ) : (
          <StartJobPanel session={session} autoTag={autoTag} onStarted={onOpenChange} />
        )}

        {job && !isJobActive ? <FinishedJobSummary job={job} /> : null}
        {job && job.writeCount > 0 ? (
          <section className="flex flex-col gap-2 border-t pt-3">
            <h3 className="text-sm font-medium">How the agent did</h3>
            <AutoTagReport key={`${job.id}-${job.writeCount}`} jobId={job.id} />
          </section>
        ) : null}

        {autoTag.error ? (
          <p className="text-xs text-destructive">{autoTag.error.message}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type AutoTagControls = ReturnType<typeof useAutoTagJob>;

function StartJobPanel({
  session,
  autoTag,
  onStarted,
}: {
  session: VideoSession;
  autoTag: AutoTagControls;
  onStarted: (open: boolean) => void;
}) {
  const router = useRouter();
  const hasLibraryVideo = session.videoSourceType === "library" && Boolean(session.videoRelativePath);
  const hasScoringTags = session.tags.some((tag) => tag.side && tag.action);
  const hasAgentTags = session.tags.some((tag) => tag.origin === "agent");

  if (hasAgentTags) {
    return (
      <p className="text-sm text-muted-foreground">
        This bout was auto-tagged. Correct its tags in the list, and the report below updates to match.
      </p>
    );
  }

  if (!hasLibraryVideo) {
    return (
      <p className="text-sm text-muted-foreground">
        Attach this bout&apos;s video from the library first. Temporary files can&apos;t be read by the agent.
      </p>
    );
  }

  const handleBenchmark = async () => {
    const { sessionId } = await autoTag.startBenchmark();
    onStarted(false);
    router.push(`/bouts/${sessionId}`);
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <TaggingOptionsNote session={session} />
      {hasScoringTags ? (
        <p className="text-muted-foreground">
          This bout is already tagged, so the agent will run on a copy without tags.
          Its results are then compared with your tags here.
        </p>
      ) : null}
      <DialogFooter>
        <Button
          onClick={() => void (hasScoringTags ? handleBenchmark() : autoTag.startJob())}
          disabled={autoTag.isStarting}
        >
          {autoTag.isStarting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {hasScoringTags ? "Run benchmark on a copy" : "Start auto-tag"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function TaggingOptionsNote({ session }: { session: VideoSession }) {
  const enabledOptions = [
    isMatchClockEnabled(session) ? "match clock" : null,
    isStripZoneEnabled(session) ? "strip zone" : null,
  ].filter(Boolean);
  return (
    <p className="text-muted-foreground">
      {enabledOptions.length > 0
        ? `Every tag will include the ${enabledOptions.join(" and ")}.`
        : "Match clock and strip zone are off for this bout. Turn them on in the bout details before starting if you want them; they lock after the first tag."}
    </p>
  );
}

function ActiveJobPanel({ job, autoTag }: { job: AutoTagJobView; autoTag: AutoTagControls }) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const canLaunch = job.launchCommand !== null;

  const copyCommand = async () => {
    if (!job.launchCommand) return;
    await navigator.clipboard.writeText(job.launchCommand);
    setCopyState("copied");
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          {job.status === "preparing" ? <Loader2 className="size-3 animate-spin" /> : null}
          {formatAutoTagJobStatus(job.status)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {job.writeCount} tag {job.writeCount === 1 ? "change" : "changes"} · {job.framesUsed}/{job.frameBudget} look-closer frames
        </span>
      </div>

      {job.status === "preparing" ? (
        <p className="text-muted-foreground">
          Cutting overview frames from the video. This takes under a minute for a typical bout.
        </p>
      ) : null}

      {canLaunch ? (
        <div className="flex flex-col gap-2">
          <code className="block overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
            {job.launchCommand}
          </code>
          {autoTag.terminalResult && !autoTag.terminalResult.opened ? (
            <p className="text-xs text-destructive">{autoTag.terminalResult.error}</p>
          ) : null}
        </div>
      ) : null}

      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          variant="ghost"
          onClick={() => void autoTag.cancelJob(job.id)}
          disabled={autoTag.isCancelling}
        >
          <Square data-icon="inline-start" />
          Cancel job
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void copyCommand()} disabled={!canLaunch}>
            <Copy data-icon="inline-start" />
            {copyState === "copied" ? "Copied" : "Copy command"}
          </Button>
          <Button
            onClick={() => void autoTag.openInTerminal(job.id)}
            disabled={!canLaunch || autoTag.isOpeningTerminal}
          >
            <SquareTerminal data-icon="inline-start" />
            Open in Terminal
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}

function FinishedJobSummary({ job }: { job: AutoTagJobView }) {
  return (
    <div className="flex flex-col gap-1 border-t pt-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">Last run</span>
        <Badge variant="outline">{formatAutoTagJobStatus(job.status)}</Badge>
      </div>
      {job.summary ? <p className="text-muted-foreground">{job.summary}</p> : null}
      {job.error ? <p className="text-destructive">{job.error}</p> : null}
      {job.status === "abandoned" ? (
        <p className="text-muted-foreground">
          No tool calls for 20 minutes, so the job was closed. Tags it saved are kept.
        </p>
      ) : null}
    </div>
  );
}
