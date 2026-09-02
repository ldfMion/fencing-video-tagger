# Fencing Video Tagger

Next.js 16 app for tagging and analyzing fencing bouts with timestamped notes,
score reconstruction, and local video-library playback.

## Development

```bash
pnpm dev
pnpm lint
pnpm build
pnpm start
```

## Environment

`VIDEO_LIBRARY_ROOT`
- Required for the existing server-backed video-library routes.
- Must point to a readable local directory.

`SESSION_DATABASE_FILE`
- Optional path for the embedded libSQL database.
- Defaults to `.data/fencing-tags.sqlite`.
- Relative paths resolve from the repository root.

`EMBEDDING_MODEL_CACHE`
- Optional directory containing the local EmbeddingGemma model cache.
- Defaults to `.data/models`.

## Session Storage

Bout metadata, tags, comments, and embeddings persist in normalized relational
tables in a fully local libSQL database. The connection uses only a local
`file:` URL; there is no Turso Cloud connection, sync URL, or external database
service. Repository reads reassemble the existing `VideoSession` aggregate used
by SSR, TanStack Query, server actions, and exports.

The first startup after upgrading checkpoints the WAL and writes
`<database>.pre-relational-libsql.bak` before migrating the legacy JSON payloads.
The migration verifies session, tag, and comment counts before removing the
legacy tables. Original bout date text is preserved, while a normalized ISO date
column supports deterministic SQL date filters.

Drizzle migrations are committed in `drizzle/`; run `pnpm db:generate` after
schema changes and `pnpm db:studio` to inspect local data.

To initialize an empty database from a versioned session JSON file:

```bash
pnpm db:seed path/to/sessions.json
```

The input defaults to `.data/fencing-tags-sessions.json`, and the database
defaults to `SESSION_DATABASE_FILE` or `.data/fencing-tags.sqlite`. Use
`--database path/to/database.sqlite` to target another file. Seeding refuses to
modify a database that already contains sessions or tags.

Older browser `localStorage` data is not imported automatically. When the
server store is empty and valid legacy browser data exists, the library page
shows a one-time migration prompt.

## Local semantic search

Search uses `google/embeddinggemma-300m` through a pinned, Transformers.js-
compatible ONNX artifact. The model runs locally in Node.js with FP32 weights.
Runtime remote model access is disabled.

Provision the model once, then generate embeddings for existing comments:

```bash
pnpm embeddings:provision
pnpm embeddings:backfill
```

The model cache is about 1.2 GB and is stored under `.data/` by default. Comment
embeddings are truncated from the model's 768-dimensional Matryoshka output to
256 dimensions and normalized again. Each row records the base model revision,
ONNX artifact revision, prompt version, dimensions, and SHA-256 comment hash so
stale rows can be regenerated.

The backend exposes the `searchComments` server function from
`lib/server/comment-search-service.ts`. It accepts:

```json
{
  "query": "perdi o equilíbrio depois do ataque",
  "filters": {
    "fencer": "Mion",
    "mistake": "execution",
    "dateFrom": "2026-01-01"
  },
  "limit": 20
}
```

Supported SQL filters are `fencer`, `side`, `action`, `mistake`, `period`,
`stripZone`, `dateFrom`, and `dateTo`. Semantic candidates come from libSQL's
native cosine vector index. Search automatically regenerates missing or stale
comment embeddings before querying. A future client search component can import
and call this server action directly; no public search route handler is needed.

## Notes

- Temporary local video files still stay browser-local and must be reloaded
  after refresh.
- Library-backed videos still stream through the existing `/api/video-library`
  and `/api/videos/[sessionId]` route handlers.
