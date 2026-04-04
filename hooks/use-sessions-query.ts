"use client";

import { useQuery } from "@tanstack/react-query";
import { getSessionsAction } from "@/app/actions/session-actions";
import type { VideoSession } from "@/lib/types";

export const sessionsQueryKey = ["sessions"] as const;

export function useSessionsQuery(initialSessions?: VideoSession[]) {
  const query = useQuery({
    queryKey: sessionsQueryKey,
    queryFn: getSessionsAction,
    initialData: initialSessions,
  });

  return {
    ...query,
    sessions: query.data ?? [],
  };
}
