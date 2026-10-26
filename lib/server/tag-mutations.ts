import "server-only";

import { computeNextTagSequence, createTagRecord } from "@/lib/session-service";
import { getSessionRepository } from "@/lib/server/repositories/session-repository";
import { assertTagMetadataMatchesSession } from "@/lib/tagging";
import type { Tag, TagContent, TagOrigin, VideoSession } from "@/lib/types";

interface TagProvenance {
  tagId?: string;
  createdAt?: number;
  origin?: TagOrigin;
  autoTagJobId?: string;
}

export async function requireSession(sessionId: string): Promise<VideoSession> {
  const session = await getSessionRepository().findById(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} was not found`);
  }
  return session;
}

export function getNextLastModified(session: VideoSession): number {
  return Math.max(Date.now(), session.lastModified + 1);
}

export async function addTagToSession(
  sessionId: string,
  params: TagContent,
  provenance: TagProvenance = {},
): Promise<{ session: VideoSession; tag: Tag }> {
  const session = await requireSession(sessionId);
  const nextTag: Tag = {
    ...createTagRecord(params, session, {
      tagId: provenance.tagId,
      createdAt: provenance.createdAt,
      seq: computeNextTagSequence(session),
    }),
    ...(provenance.origin && { origin: provenance.origin }),
    ...(provenance.autoTagJobId && { autoTagJobId: provenance.autoTagJobId }),
  };
  const nextSession = {
    ...session,
    tags: [...session.tags, nextTag],
    lastModified: getNextLastModified(session),
  };
  return {
    session: await getSessionRepository().createTag(session, nextSession, nextTag),
    tag: nextTag,
  };
}

export async function updateTagInSession(
  sessionId: string,
  tagId: string,
  updates: Partial<TagContent>,
): Promise<{ session: VideoSession; tag: Tag }> {
  const session = await requireSession(sessionId);
  const previousTag = findTagOrThrow(session, tagId);
  const nextTag = { ...previousTag, ...updates };
  assertTagMetadataMatchesSession(session, nextTag);
  const nextSession = {
    ...session,
    tags: session.tags.map((tag) => tag.id === nextTag.id ? nextTag : tag),
    lastModified: getNextLastModified(session),
  };
  return {
    session: await getSessionRepository().updateTag(session, nextSession, nextTag),
    tag: nextTag,
  };
}

export async function deleteTagFromSession(
  sessionId: string,
  tagId: string,
): Promise<VideoSession> {
  const session = await requireSession(sessionId);
  findTagOrThrow(session, tagId);
  const nextSession = {
    ...session,
    tags: session.tags.filter((tag) => tag.id !== tagId),
    lastModified: getNextLastModified(session),
  };
  return getSessionRepository().deleteTag(session, nextSession, tagId);
}

function findTagOrThrow(session: VideoSession, tagId: string): Tag {
  const tag = session.tags.find((candidate) => candidate.id === tagId);
  if (!tag) {
    throw new Error(`Tag ${tagId} was not found in session ${session.id}`);
  }
  return tag;
}
