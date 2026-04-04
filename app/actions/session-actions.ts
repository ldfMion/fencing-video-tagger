"use server";

import {
  addTag,
  createSession,
  deleteSession,
  deleteTag,
  type AddTagInput,
  type CreateSessionInput,
  type DeleteSessionInput,
  type DeleteTagInput,
  getSessionById,
  importSessions,
  listSessions,
  type ImportSessionsInput,
  updateSession,
  type UpdateSessionInput,
  updateTag,
  type UpdateTagInput,
} from "@/lib/server/session-service";
import type { VideoSession } from "@/lib/types";

export async function getSessionsAction(): Promise<VideoSession[]> {
  return listSessions();
}

export async function getSessionAction(
  sessionId: string,
): Promise<VideoSession | null> {
  return getSessionById(sessionId);
}

export async function createSessionAction(
  input: CreateSessionInput,
): Promise<VideoSession> {
  return createSession(input);
}

export async function updateSessionAction(
  input: UpdateSessionInput,
): Promise<VideoSession> {
  return updateSession(input);
}

export async function deleteSessionAction(
  input: DeleteSessionInput,
): Promise<{ sessionId: string }> {
  return deleteSession(input);
}

export async function addTagAction(input: AddTagInput): Promise<VideoSession> {
  return addTag(input);
}

export async function updateTagAction(
  input: UpdateTagInput,
): Promise<VideoSession> {
  return updateTag(input);
}

export async function deleteTagAction(
  input: DeleteTagInput,
): Promise<VideoSession> {
  return deleteTag(input);
}

export async function importSessionsAction(
  input: ImportSessionsInput,
): Promise<{ imported: number; skipped: number }> {
  return importSessions(input);
}
