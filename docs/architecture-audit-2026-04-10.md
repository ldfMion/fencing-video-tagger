# Architecture and Code Health Audit (2026-04-10)

## Scope

- Reviewed application structure (`app/`, `components/`, `hooks/`, `lib/`, and `app/api`).
- Ran static checks (`pnpm lint`, `pnpm build`).
- Focused on architectural boundaries, bug risks, data consistency, and maintainability.

## High-priority issues

1. **Tag seek button disabled-state logic is incorrect (user-visible bug).**
   - In `components/tag-list.tsx`, seek buttons are disabled only when both `timestamp` is missing **and** `onSeek` is not provided.
   - This means entries can remain clickable when `onSeek` is undefined, creating a dead control.
   - Suggested fix: disable when either `timestamp` is missing **or** `onSeek` is absent.

2. **`/api/videos/[sessionId]` does not validate `sessionId` against session metadata.**
   - Route reads the `path` query parameter and resolves file access from it, but `sessionId` is unused.
   - As implemented, `sessionId` currently has no functional access-control purpose and can be any value.
   - Suggested fix: look up session by `sessionId`, require matching `videoRelativePath`, and reject mismatches.

3. **Potential timeout/leak issues in video hook lifecycle.**
   - `hooks/use-video.ts` uses `setTimeout` for playback retry and seek fallback but does not fully clear these timers on unmount.
   - This can cause state updates after unmount and unnecessary work in rapid route/tab transitions.
   - Suggested fix: track all timeout handles in refs and clear them in a cleanup effect.

## Medium-priority issues

4. **Event listeners in `useVideo` are reattached frequently due effect dependencies.**
   - Listener setup effect depends on `isSeeking`, so each seeking state change tears down and re-registers all media listeners.
   - This is unnecessary churn and can introduce subtle timing edge-cases.
   - Suggested fix: avoid `isSeeking` in the listener-registration dependency list by using refs for transient checks.

5. **Client/server session logic split is clean but naming is confusing.**
   - `lib/session-service.ts` and `lib/server/session-service.ts` both expose similarly named functions in different environments.
   - This raises accidental-import risk and increases onboarding complexity.
   - Suggested fix: rename one side (e.g. `lib/session-domain.ts` for shared pure logic, server file as `session-command-service.ts`).

6. **Error messages may leak filesystem path details.**
   - Repository read/parse errors include absolute file paths in thrown messages.
   - If bubbled to client-visible surfaces, this reveals environment details.
   - Suggested fix: log detailed messages server-side, return sanitized generic user-facing messages.

7. **Video library scan is recursively eager and unbounded per request.**
   - `listVideoLibraryItems()` recursively stats every file each request and sorts in-memory.
   - Large libraries can slow endpoint latency and consume resources.
   - Suggested fix: add caching, pagination, optional depth limits, and/or incremental indexing.

8. **Range streaming implementation lacks backpressure handling.**
   - `createVideoStream()` manually bridges Node stream events to Web `ReadableStream` with enqueue-only behavior.
   - Works, but doesn’t fully honor backpressure or pause/resume flow.
   - Suggested fix: use Node/Web stream adapters where available, or implement pull-aware flow control.

## Low-priority issues / maintainability

9. **Mixed storage-era concerns still live in UI path.**
   - Import/migration component still coordinates localStorage migration flags and parsing logic.
   - While practical, this couples legacy migration concerns into routine UI controls.
   - Suggested fix: move migration flow behind dedicated admin/migration utility or one-time bootstrap flow.

10. **No automated tests around core domain helpers.**
   - Tag ordering, date filtering, migration parsing, and session mutation helpers are all test-worthy logic.
   - Current reliance on lint/build alone misses regressions in domain behavior.
   - Suggested next step: add unit tests for `lib/session-service.ts`, `lib/session-selectors.ts`, and `lib/server/session-service.ts`.

11. **Session sorting/filtering assumptions rely on date-string format consistency.**
   - Filtering compares date strings lexicographically.
   - Works for canonical `YYYY-MM-DD`, but brittle for non-normalized inputs.
   - Suggested fix: normalize/stamp dates at write-time, validate format at boundaries.

12. **Context cleanup does not revoke blob URLs on provider unmount.**
   - Blob URLs are revoked on state transitions, but no explicit unmount cleanup exists.
   - Usually minor, but worth tightening for long-running sessions.
   - Suggested fix: add `useEffect` cleanup in `VideoProvider` to revoke current blob URL on unmount.

## Check results

- `pnpm lint`: passed.
- `pnpm build`: failed in this environment due inability to fetch Google Fonts (`Geist`, `Geist Mono`, `IBM Plex Sans`), consistent with known sandbox/network limitation.

## Suggested remediation order

1. Fix seek button disabled logic.
2. Enforce `sessionId` ↔ video-path validation in `/api/videos/[sessionId]`.
3. Harden timeout/event lifecycle in `useVideo`.
4. Add unit tests for session/tag/domain helpers.
5. Address performance/security hardening items (video indexing, message sanitization).
