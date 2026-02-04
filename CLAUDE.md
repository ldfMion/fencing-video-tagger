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

### Component Structure

```
app/page.tsx (main page, client component)
├── VideoPlayer     - Video element with playback controls, zoom/pan, keyboard shortcuts
├── TagForm         - Add tags at current timestamp
├── TagList         - Display/delete tags, click to seek
└── VideoLibrary    - Previous video sessions from localStorage
```

### Types (`lib/types.ts`)

- `Tag`: { id, timestamp, text, createdAt }
- `VideoSession`: { id, fileName, tags[], lastModified }

### UI Components

Uses shadcn/ui components in `components/ui/` with Radix primitives. Styling via Tailwind CSS v4.
