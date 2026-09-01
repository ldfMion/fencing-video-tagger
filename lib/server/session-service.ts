import "server-only";

import { z } from "zod";
import {
  applySessionUpdates,
  createSessionRecord,
  computeNextTagSequence,
  createSessionRecordWithLibraryVideo,
  createSessionRecordWithTemporaryVideo,
  createTagRecord,
  type ServerSessionVideoSelection,
} from "@/lib/session-service";
import {
  assertTagMetadataMatchesSession,
  assertTaggingOptionsAreMutable,
} from "@/lib/tagging";
import { getSessionRepository } from "@/lib/server/repositories/session-repository";
import {
  TagContentSchema,
  TaggingOptionsSchema,
  type VideoSession,
  VideoSessionSchema,
  VideoSourceTypeSchema,
} from "@/lib/types";

const VideoLibraryItemSchema = z.object({
  relativePath: z.string(),
  fileName: z.string(),
  size: z.number(),
  modifiedAt: z.number(),
  mimeType: z.string(),
});

const ServerSessionVideoSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("none"),
  }),
  z.object({
    kind: z.literal("library"),
    video: VideoLibraryItemSchema,
  }),
  z.object({
    kind: z.literal("temporary"),
    fileName: z.string(),
    fileLastModified: z.number().optional(),
  }),
]);

const SessionDraftParamsSchema = z.object({
  leftFencer: z.string().optional(),
  rightFencer: z.string().optional(),
  boutDate: z.string().optional(),
  externalSource: z.string().optional(),
  taggingOptions: TaggingOptionsSchema.optional(),
});

const UpdateSessionParamsSchema = z.object({
  fileName: z.string().nullable().optional(),
  videoRelativePath: z.string().nullable().optional(),
  videoMimeType: z.string().nullable().optional(),
  videoSourceType: VideoSourceTypeSchema.nullable().optional(),
  leftFencer: z.string().nullable().optional(),
  rightFencer: z.string().nullable().optional(),
  boutDate: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  taggingOptions: TaggingOptionsSchema.nullable().optional(),
});

const AddTagParamsSchema = TagContentSchema;

const CreateSessionInputSchema = z.object({
  sessionId: z.string().optional(),
  params: SessionDraftParamsSchema.default({}),
  videoSelection: ServerSessionVideoSelectionSchema.default({ kind: "none" }),
});

const UpdateSessionInputSchema = z.object({
  sessionId: z.string(),
  updates: UpdateSessionParamsSchema,
});

const DeleteSessionInputSchema = z.object({
  sessionId: z.string(),
});

const AddTagInputSchema = z.object({
  sessionId: z.string(),
  tagId: z.string().optional(),
  createdAt: z.number().optional(),
  params: AddTagParamsSchema,
});

const UpdateTagInputSchema = z.object({
  sessionId: z.string(),
  tagId: z.string(),
  updates: TagContentSchema.partial(),
});

const DeleteTagInputSchema = z.object({
  sessionId: z.string(),
  tagId: z.string(),
});

const ImportSessionsInputSchema = z.object({
  sessions: z.array(VideoSessionSchema),
});

export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;
export type UpdateSessionInput = z.infer<typeof UpdateSessionInputSchema>;
export type DeleteSessionInput = z.infer<typeof DeleteSessionInputSchema>;
export type AddTagInput = z.infer<typeof AddTagInputSchema>;
export type UpdateTagInput = z.infer<typeof UpdateTagInputSchema>;
export type DeleteTagInput = z.infer<typeof DeleteTagInputSchema>;
export type ImportSessionsInput = z.infer<typeof ImportSessionsInputSchema>;

export async function listSessions(): Promise<VideoSession[]> {
  return getSessionRepository().list();
}

export async function getSessionById(
  sessionId: string,
): Promise<VideoSession | null> {
  return getSessionRepository().findById(z.string().parse(sessionId));
}

export async function createSession(
  input: CreateSessionInput,
): Promise<VideoSession> {
  const parsedInput = CreateSessionInputSchema.parse(input);
  const session = createSessionFromInput(parsedInput);
  return getSessionRepository().create(session);
}

export async function updateSession(
  input: UpdateSessionInput,
): Promise<VideoSession> {
  const parsedInput = UpdateSessionInputSchema.parse(input);
  const repository = getSessionRepository();
  const previousSession = await requireSession(parsedInput.sessionId);
  const nextSession = applySessionUpdates(previousSession, parsedInput.updates);

  assertTaggingOptionsAreMutable(previousSession, nextSession.taggingOptions);

  return repository.update(nextSession);
}

export async function deleteSession(
  input: DeleteSessionInput,
): Promise<{ sessionId: string }> {
  const parsedInput = DeleteSessionInputSchema.parse(input);
  const deleted = await getSessionRepository().delete(parsedInput.sessionId);

  if (!deleted) {
    throw new Error(`Session ${parsedInput.sessionId} was not found`);
  }

  return {
    sessionId: parsedInput.sessionId,
  };
}

export async function addTag(input: AddTagInput): Promise<VideoSession> {
  const parsedInput = AddTagInputSchema.parse(input);
  const repository = getSessionRepository();
  const session = await requireSession(parsedInput.sessionId);
  const nextTag = createTagRecord(parsedInput.params, session, {
    tagId: parsedInput.tagId,
    createdAt: parsedInput.createdAt,
    seq: computeNextTagSequence(session),
  });
  const nextSession = {
    ...session,
    tags: [...session.tags, nextTag],
    lastModified: Date.now(),
  };
  return repository.createTag(nextSession, nextTag);
}

export async function updateTag(input: UpdateTagInput): Promise<VideoSession> {
  const parsedInput = UpdateTagInputSchema.parse(input);
  const repository = getSessionRepository();
  const session = await requireSession(parsedInput.sessionId);
  const previousTag = session.tags.find((tag) => tag.id === parsedInput.tagId);
  if (!previousTag) {
    throw new Error(
      `Tag ${parsedInput.tagId} was not found in session ${parsedInput.sessionId}`,
    );
  }

  const nextTag = { ...previousTag, ...parsedInput.updates };
  assertTagMetadataMatchesSession(session, nextTag);
  const nextSession = {
    ...session,
    tags: session.tags.map((tag) => tag.id === nextTag.id ? nextTag : tag),
    lastModified: Date.now(),
  };
  return repository.updateTag(nextSession, nextTag);
}

export async function deleteTag(input: DeleteTagInput): Promise<VideoSession> {
  const parsedInput = DeleteTagInputSchema.parse(input);
  const repository = getSessionRepository();
  const session = await requireSession(parsedInput.sessionId);
  const nextTags = session.tags.filter((tag) => tag.id !== parsedInput.tagId);
  if (nextTags.length === session.tags.length) {
    throw new Error(
      `Tag ${parsedInput.tagId} was not found in session ${parsedInput.sessionId}`,
    );
  }
  const nextSession = { ...session, tags: nextTags, lastModified: Date.now() };
  return repository.deleteTag(nextSession, parsedInput.tagId);
}

export async function importSessions(
  input: ImportSessionsInput,
): Promise<{ imported: number; skipped: number }> {
  const parsedInput = ImportSessionsInputSchema.parse(input);
  return getSessionRepository().import(parsedInput.sessions);
}

async function requireSession(sessionId: string): Promise<VideoSession> {
  const session = await getSessionRepository().findById(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} was not found`);
  }
  return session;
}

function createSessionFromInput(input: {
  sessionId?: string;
  params: z.infer<typeof SessionDraftParamsSchema>;
  videoSelection: ServerSessionVideoSelection;
}): VideoSession {
  switch (input.videoSelection.kind) {
    case "library":
      return createSessionRecordWithLibraryVideo(input.videoSelection.video, input.params, {
        sessionId: input.sessionId,
      });
    case "temporary":
      return createSessionRecordWithTemporaryVideo(
        input.videoSelection.fileName,
        input.videoSelection.fileLastModified,
        input.params,
        {
          sessionId: input.sessionId,
        },
      );
    case "none":
    default:
      return createSessionRecord(input.params, {
        sessionId: input.sessionId,
      });
  }
}
