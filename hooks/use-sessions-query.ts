"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getSessionById,
  listSessions,
} from "@/lib/server/session-service";
import type { VideoSession } from "@/lib/types";

export const sessionsQueryKey = ["sessions"] as const;

export const sessionQueryKey = (sessionId: string) =>
  ["sessions", "detail", sessionId] as const;

export function useSessionsQuery(
  initialSessions?: VideoSession[],
  enabled = true,
) {
  const query = useQuery({
    queryKey: sessionsQueryKey,
    queryFn: listSessions,
    initialData: initialSessions,
    enabled,
  });

  return {
    ...query,
    sessions: query.data ?? [],
  };
}

export function useSessionQuery(
  sessionId: string,
  initialSession?: VideoSession | null,
  enabled = true,
) {
  return useQuery({
    queryKey: sessionQueryKey(sessionId),
    queryFn: () => getSessionById(sessionId),
    initialData: initialSession,
    enabled,
  });
}
