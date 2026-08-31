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
import { getSessionRepository } from "@/lib/server/session-repository";
import { getTouchRepository } from "@/lib/server/touch-repository";
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
  return getSessionRepository().listSessions();
}

export async function getSessionById(
  sessionId: string,
): Promise<VideoSession | null> {
  return getSessionRepository().getSessionById(z.string().parse(sessionId));
}

export async function createSession(
  input: CreateSessionInput,
): Promise<VideoSession> {
  const parsedInput = CreateSessionInputSchema.parse(input);
  const session = createSessionFromInput(parsedInput);
  return getSessionRepository().createSession(session);
}

export async function updateSession(
  input: UpdateSessionInput,
): Promise<VideoSession> {
  const parsedInput = UpdateSessionInputSchema.parse(input);
  return getSessionRepository().mutateSessions((sessions) => {
    const sessionIndex = sessions.findIndex(
      (session) => session.id === parsedInput.sessionId,
    );

    if (sessionIndex === -1) {
      throw new Error(`Session ${parsedInput.sessionId} was not found`);
    }

    const previousSession = sessions[sessionIndex];
    const nextSession = applySessionUpdates(previousSession, parsedInput.updates);

    assertTaggingOptionsAreMutable(previousSession, nextSession.taggingOptions);

    return {
      sessions: sessions.map((session, index) =>
        index === sessionIndex ? nextSession : session,
      ),
      result: nextSession,
    };
  });
}

export async function deleteSession(
  input: DeleteSessionInput,
): Promise<{ sessionId: string }> {
  const parsedInput = DeleteSessionInputSchema.parse(input);
  const deleted = await getSessionRepository().deleteSession(parsedInput.sessionId);

  if (!deleted) {
    throw new Error(`Session ${parsedInput.sessionId} was not found`);
  }

  return {
    sessionId: parsedInput.sessionId,
  };
}

export async function addTag(input: AddTagInput): Promise<VideoSession> {
  const parsedInput = AddTagInputSchema.parse(input);
  return getTouchRepository().mutateTouches(parsedInput.sessionId, (session, tags) => {
    const nextTag = createTagRecord(parsedInput.params, session, {
      tagId: parsedInput.tagId,
      createdAt: parsedInput.createdAt,
      seq: computeNextTagSequence(session),
    });
    return [...tags, nextTag];
  });
}

export async function updateTag(input: UpdateTagInput): Promise<VideoSession> {
  const parsedInput = UpdateTagInputSchema.parse(input);
  return getTouchRepository().mutateTouches(parsedInput.sessionId, (session, tags) => {
    let foundTag = false;
    const nextTags = tags.map((tag) => {
      if (tag.id !== parsedInput.tagId) {
        return tag;
      }

      foundTag = true;
      const nextTag = { ...tag, ...parsedInput.updates };
      assertTagMetadataMatchesSession(session, nextTag);
      return nextTag;
    });

    if (!foundTag) {
      throw new Error(
        `Tag ${parsedInput.tagId} was not found in session ${parsedInput.sessionId}`,
      );
    }
    return nextTags;
  });
}

export async function deleteTag(input: DeleteTagInput): Promise<VideoSession> {
  const parsedInput = DeleteTagInputSchema.parse(input);
  return getTouchRepository().deleteTouch(parsedInput.sessionId, parsedInput.tagId);
}

export async function importSessions(
  input: ImportSessionsInput,
): Promise<{ imported: number; skipped: number }> {
  const parsedInput = ImportSessionsInputSchema.parse(input);
  return getSessionRepository().importSessions(parsedInput.sessions);
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
