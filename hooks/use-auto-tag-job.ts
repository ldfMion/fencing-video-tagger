"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAutoTagJobActive, type AutoTagJobView } from "@/lib/auto-tag/job";
import {
  cancelAutoTagJob,
  getAutoTagJobForSession,
  getAutoTagJobReport,
  openAutoTagJobInTerminal,
  startAutoTagBenchmark,
  startAutoTagJob,
} from "@/lib/server/auto-tag/auto-tag-actions";
import { sessionQueryKey } from "@/hooks/use-sessions-query";

const ACTIVE_JOB_POLL_INTERVAL_MS = 2000;

export const autoTagJobQueryKey = (sessionId: string) =>
  ["auto-tag-job", sessionId] as const;

export const autoTagReportQueryKey = (jobId: string) =>
  ["auto-tag-report", jobId] as const;

export function useAutoTagJob(sessionId: string) {
  const queryClient = useQueryClient();
  const jobQuery = useQuery({
    queryKey: autoTagJobQueryKey(sessionId),
    queryFn: () => getAutoTagJobForSession({ sessionId }),
    refetchInterval: (query) =>
      query.state.data && isAutoTagJobActive(query.state.data.status)
        ? ACTIVE_JOB_POLL_INTERVAL_MS
        : false,
  });
  const job = jobQuery.data ?? null;
  useRefreshSessionWhenAgentWrites(sessionId, job);

  const setJob = (nextJob: AutoTagJobView) =>
    queryClient.setQueryData(autoTagJobQueryKey(nextJob.boutId), nextJob);

  const startMutation = useMutation({
    mutationFn: () => startAutoTagJob({ sessionId }),
    onSuccess: setJob,
  });
  const benchmarkMutation = useMutation({
    mutationFn: () => startAutoTagBenchmark({ sessionId }),
    onSuccess: ({ job: benchmarkJob }) => setJob(benchmarkJob),
  });
  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => cancelAutoTagJob({ jobId }),
    onSuccess: setJob,
  });
  const openTerminalMutation = useMutation({
    mutationFn: (jobId: string) => openAutoTagJobInTerminal({ jobId }),
  });

  return {
    job,
    isLoading: jobQuery.isLoading,
    startJob: startMutation.mutateAsync,
    startBenchmark: benchmarkMutation.mutateAsync,
    cancelJob: cancelMutation.mutateAsync,
    openInTerminal: openTerminalMutation.mutateAsync,
    terminalResult: openTerminalMutation.data ?? null,
    isStarting: startMutation.isPending || benchmarkMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isOpeningTerminal: openTerminalMutation.isPending,
    error: startMutation.error ?? benchmarkMutation.error ?? cancelMutation.error ??
      openTerminalMutation.error ?? null,
  };
}

export function useAutoTagReport(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: autoTagReportQueryKey(jobId ?? ""),
    queryFn: () => getAutoTagJobReport({ jobId: jobId! }),
    enabled: enabled && jobId !== null,
    staleTime: 0,
  });
}

function useRefreshSessionWhenAgentWrites(sessionId: string, job: AutoTagJobView | null) {
  const queryClient = useQueryClient();
  const lastWriteCountRef = useRef<number | null>(null);
  const writeCount = job?.writeCount ?? null;

  useEffect(() => {
    if (writeCount === null) return;
    const previousWriteCount = lastWriteCountRef.current;
    lastWriteCountRef.current = writeCount;
    if (previousWriteCount !== null && writeCount !== previousWriteCount) {
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey(sessionId) });
    }
  }, [queryClient, sessionId, writeCount]);
}
