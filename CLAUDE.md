# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev      # Start development server (http://localhost:3000)
pnpm build    # Build for production
pnpm lint     # Run ESLint
pnpm start    # Start production server
```

## Architecture

This is a **Fencing Video Tagger** application built with Next.js 16 (App Router) for analyzing fencing videos with timestamped tags.

### Key Data Flow

1. User selects a video file → creates browser Object URL
2. Video playback state managed by `useVideo` hook
3. Tags are stored per video filename in localStorage via `useSessions` hook
4. Tags reference video timestamps and allow seeking back to those moments

### Core Hooks

- **`hooks/use-video.ts`**: Video playback state machine (play/pause, seek, frame stepping, skip, playback speed, zoom, pan). Returns refs and callbacks for controlling an HTML5 video element.

- **`hooks/use-sessions.ts`**: Tag persistence layer using `useSyncExternalStore` pattern. Manages an in-memory store that syncs bidirectionally with localStorage. Sessions are keyed by video filename.

### Routes

- **`/`** — Main page: video library list, file picker
- **`/bouts/[id]`** — Individual bout page: video player, tag form, tag list, bout analysis, metadata editing

### Component Structure

```
app/layout.tsx (root layout)
├── ThemeProvider       - next-themes provider (defaults to dark, supports system preference)
└── VideoProvider       - Video context provider
    app/page.tsx (main page, client component)
    ├── VideoLibrary    - Previous video sessions from localStorage
    app/bouts/[id]/page.tsx (bout page, client component)
    ├── VideoPlayer        - Video element with playback controls, zoom/pan, keyboard shortcuts
    ├── TagForm            - Add tags at current timestamp
    ├── TagList            - Display/delete tags, click to seek
    ├── BoutAnalysis       - Score card and event-by-event scoring timeline
    ├── BoutMetadataForm   - Edit fencer names, bout date
    └── ExportButton       - CSV export of session data
```

### Shared Logic (`lib/`)

- **`lib/types.ts`** — Zod schemas and TypeScript types. Storage versioning with migration from v0.
- **`lib/utils.ts`** — `cn()` (Tailwind class merging) and `formatTime()` (seconds → `m:ss` string).
- **`lib/score.ts`** — `computeScore(tags)` returns final left/right score; `computeRunningScore(tags)` returns event-by-event `ScoringEvent[]` timeline. `computeScore` delegates to `computeRunningScore`.
- **`lib/constants.ts`** — `SIDE_COLORS` with `left`/`right` keys containing `text` and `badge` Tailwind class strings for fencer side coloring (red for left, green for right).

### Types (`lib/types.ts`)

- `Tag`: { id, timestamp, comment, createdAt, side?, action?, mistake? }
- `VideoSession`: { id, fileName, tags[], lastModified, leftFencer?, rightFencer?, boutDate? }
- `ActionCode`: Union of fencing action notation strings (e.g., "A-P", "R-R", "yc", "rc")
- `Side`: "L" | "R"
- `MistakeType`: "tactical" | "execution"

### UI Components

Uses shadcn/ui components in `components/ui/` with Radix primitives. Styling via Tailwind CSS v4. Dark mode managed by `next-themes` with class-based toggling (`@custom-variant dark` in globals.css). Theme defaults to dark.

## Conventions

- **Shared utilities belong in `lib/`**: Common functions like `formatTime`, scoring logic, and constants live in `lib/` and are imported from there. Do not create local copies in components or hooks.
- **Side colors**: Left fencer = red, right fencer = green. Always use `SIDE_COLORS` from `lib/constants.ts` instead of hardcoding Tailwind color classes.
- **Scoring logic**: Use `computeScore`/`computeRunningScore` from `lib/score.ts`. Do not reimplement scoring loops in components.
- **Prefer shadcn/ui components**: Use `Button`, `Badge`, etc. from `components/ui/` for interactive elements. Plain `<button>` is acceptable only for unstyled click targets that need no visual treatment.
- **All components are client components**: This app is fully client-side (localStorage-based). Components use `"use client"` directive.
- **`use-video.ts` internal helpers**: `playWithRetry` (AbortError retry), `clampToVideoDuration` (time clamping), and `panBy` (directional panning) are internal deduplication helpers — keep them when modifying video logic.

# Agent Instructions
- When planning, don't show code snippets unless specified or unless it is a technical change. During the planning, state stick to concepts.
