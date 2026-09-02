"use client";

import { useQuery } from "@tanstack/react-query";
import { listSessions } from "@/lib/server/session-service";
import type { VideoSession } from "@/lib/types";

export const sessionsQueryKey = ["sessions"] as const;

export function useSessionsQuery(initialSessions?: VideoSession[]) {
  const query = useQuery({
    queryKey: sessionsQueryKey,
    queryFn: listSessions,
    initialData: initialSessions,
  });

  return {
    ...query,
    sessions: query.data ?? [],
  };
}
