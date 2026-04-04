# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js 16 App Router project for tagging and analyzing fencing bouts. Route entry points live in `app/`, including the main library page at `app/page.tsx`, bout detail pages in `app/bouts/[id]/page.tsx`, and fencer views in `app/fencers/[name]/page.tsx`.

Reusable UI lives in `components/`, with base shadcn/Radix primitives under `components/ui/`. Shared state and behavior belong in `hooks/` and `contexts/`. Domain logic, schemas, scoring, and constants belong in `lib/`. Static assets live in `public/`, and one-off utilities such as CSV import scripts live in `scripts/`.

## Build, Test, and Development Commands
- `pnpm dev`: start the local dev server on `http://localhost:3000`.
- `pnpm build`: create the production build and catch build-time regressions.
- `pnpm start`: serve the production build locally.
- `pnpm lint`: run ESLint with the Next.js + TypeScript config.
- `pnpm import-csv`: run `scripts/import-csv.ts` for spreadsheet-based data import.

Use `pnpm` consistently; the lockfile and workspace config are already committed.

## Coding Style & Naming Conventions
Write TypeScript with 2-space indentation avoided here in favor of the repository’s existing formatter output: follow the current file style exactly. Use double quotes, trailing commas where the codebase already has them, and keep React components in PascalCase (`VideoPlayer.tsx`), hooks in `use-*` form (`use-video.ts`), and shared helpers in `lib/`.

Do not duplicate scoring or styling rules in components. Reuse `lib/score.ts`, `lib/constants.ts`, and the UI primitives in `components/ui/`. Prefer small client components and colocate route-specific logic with the route.

## Testing Guidelines
There is no dedicated test suite configured yet. For now, treat `pnpm lint` and `pnpm build` as required checks before opening a PR. When adding tests later, place them next to the feature or in a clear `__tests__` location and name them after the unit under test.

## Commit & Pull Request Guidelines
Recent commits use short, imperative summaries such as `added some charts` and `imported bouts from spreadsheet`. Keep commit messages brief, descriptive, and focused on one change.

PRs should explain the user-visible behavior change, note any data-model or localStorage impact, and include screenshots or short recordings for UI updates. Link the related issue when applicable and list the commands you ran to validate the change.

## Security & Data Notes
Session data is stored in browser `localStorage`. Avoid introducing secrets into client code, and document any schema changes in `lib/types.ts` so stored sessions remain migratable.

## Local Video Library Notes
`VIDEO_LIBRARY_ROOT` must point to a locally readable directory. Avoid protected macOS locations such as `~/Library/Mobile Documents/...` unless the running Node/Next.js process has permission to read them. If the route handlers cannot read the directory or file, persisted attached videos will fail after reload even if temporary blob playback worked earlier.

## Media Debugging
This app has two playback paths:
- temporary playback: in-tab `blob:` URL only
- persisted playback: `/api/videos/[sessionId]` route handler

If a video works before reload but fails after reload, debug the persisted route path first, not the player UI. Check:
- `GET /api/video-library`
- `HEAD` or `GET /api/videos/[sessionId]?...`
- `.next/dev/logs/next-development.log`

Treat browser "video format not supported" as possibly meaning a bad server response or unreadable file, not only an actual codec problem.

## UI Verification Notes
For tagging-page UI changes, verify on a laptop-height viewport with a real bout that has a video loaded. Short viewports are the main failure case for overflow, clipped controls, and form/player overlap.
