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

`SESSION_STORE_FILE`
- Optional path for the server-backed session JSON store.
- Defaults to `.data/fencing-tags-sessions.json`.
- Relative paths resolve from the repository root.

## Session Storage

Sessions now persist on the server in a JSON file using the shared
`StorageEnvelope` shape from `lib/types.ts`. The app loads sessions through SSR,
hydrates the client with TanStack Query, and performs session/tag CRUD via
server actions.

Older browser `localStorage` data is not imported automatically. When the
server store is empty and valid legacy browser data exists, the library page
shows a one-time migration prompt.

## Notes

- Temporary local video files still stay browser-local and must be reloaded
  after refresh.
- Library-backed videos still stream through the existing `/api/video-library`
  and `/api/videos/[sessionId]` route handlers.
