---
inclusion: always
---

# Tech stack and rules

- Chrome/Edge extension, **Manifest V3**. Must load unpacked in Chrome 121+ and Edge 121+.
- TypeScript (strict), Vite build, no UI framework (plain DOM + CSS). Keep the bundle small.
- Tests: Vitest for unit tests, **fast-check** for property-based tests.
- Storage: `chrome.storage.local` only. No backend, no account, no telemetry.
- Summaries: Chrome built-in Summarizer API when available; otherwise fall back to page meta description / first paragraph. Never send page content to a remote server.
- Scheduling: `chrome.alarms` (service workers can be killed; never rely on `setInterval`).

## Code rules
- All decision logic (which tabs to bury, decay stage, epitaph, stats) lives in pure functions under `src/core/` with no `chrome.*` calls, so it can be property-tested.
- `chrome.*` calls go through thin adapters in `src/platform/`.
- Every animation respects `prefers-reduced-motion`.
- Colors meet WCAG AA contrast against the graveyard background.
- No new dependency without a reason written in the PR/commit message.
