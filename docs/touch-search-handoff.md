# Touch Search — v1 Handoff

## Goal

Provide a dedicated route for finding tagged fencing touches with semantic text search, structured filters, and immediate replay when the source video is available in the local video library.

## Search behavior

- Start with a centered search and filter area; once a search or filter is applied, move the controls into a compact sticky header.
- Support semantic text search, structured filters without text, or both together.
- Default to library-backed videos. Provide an **Include touches without replay** control for the wider tag corpus.
- Semantic queries are submitted with Enter or a Search button. Changes to filters refresh the current search.
- Semantic results sort by relevance only. Filter-only results sort newest first.
- Persist the submitted query, active filters, and selected touch in the URL.
- Load 50 results initially and offer **Load more**.

## Filters

- Surface fencer, action, mistake, and date range directly.
- Place period and strip zone under **More filters**.
- Do not expose a side filter.
- Fencer selection is multi-select: a result matches if any selected fencer participated.
- Other categorical filters are multi-select: values within one filter are ORed; different filters are ANDed.

## Results and replay

- Show tagged fencer and opponent, action and mistake, bout/date, period/match clock, one-line comment preview, and replay availability.
- Rows without a library replay are non-selectable.
- Selecting a replayable row opens a details/replay panel on the right; on narrow screens it opens as a full-screen sheet.
- Begin playback automatically at a fixed window around the tag and stop at the end of that window.

## States

- The initial empty state contains no example queries.
- A zero-result state does not recommend removing filters.
- If local semantic search is unavailable, show a clear setup/error message while preserving filter-only browsing.

## Out of scope for v1

- Saved searches.
- Replay queues or comparison mode.
