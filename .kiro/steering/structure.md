---
inclusion: always
---

# Project structure

```
public/        manifest.json (copied to dist/ unchanged)
src/
  core/          pure logic (selection, decay, epitaph, stats) + *.test.ts
                 orchestration with injected adapters: burial.ts (bury runs, buryTab),
                 grave-actions.ts (resurrect, exorcise, expiry); shared queues in queue.ts,
                 adapter interfaces in adapters.ts, test-only fakes in test-fakes.ts
  platform/      chrome.* adapters (tabs, storage, alarms, summarizer)
  background/    service worker: only wires platform adapters and chrome.* events to core
  content/       content script: extracts title, meta description, first paragraph
  graveyard/     graveyard page (html, ts, css, assets)
  popup/         toolbar popup
  options/       settings page
scripts/       build tooling run by npm scripts, not shipped: zip-dist.mjs packs dist/ as
               rest-in-tabs.zip (npm run zip), Node built-ins only
docs/demo/     static demo pages for GitHub Pages (rules in design/demo-pages.md)
.kiro/           specs, steering, hooks (must stay committed)
LICENSE          MIT
```

- One module per concern; files under ~200 lines.
- Tests sit next to the code they test (`foo.ts` → `foo.test.ts`).
