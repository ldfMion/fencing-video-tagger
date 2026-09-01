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
- Optional path for the SQLite database.
- Defaults to `.data/fencing-tags.sqlite`.
- Relative paths resolve from the repository root.

## Session Storage

Sessions and tags persist in separate SQLite tables through Drizzle. Their
domain fields remain JSON documents; relational columns only enforce identity,
tag ownership, and tag ordering. Both entity payloads are validated with their
Zod schemas whenever they enter or leave the repository. Repository reads
reassemble the existing session aggregate used by SSR, TanStack Query, server
actions, and exports.

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

## Notes

- Temporary local video files still stay browser-local and must be reloaded
  after refresh.
- Library-backed videos still stream through the existing `/api/video-library`
  and `/api/videos/[sessionId]` route handlers.
