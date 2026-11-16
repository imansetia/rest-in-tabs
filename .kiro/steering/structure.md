---
inclusion: always
---

# Project structure

```
manifest.json
src/
  core/          pure logic (selection, decay, epitaph, stats) + *.test.ts
  platform/      chrome.* adapters (tabs, storage, alarms, summarizer)
  background/    service worker: alarm handler, bury/resurrect orchestration
  content/       content script: extracts title, meta description, first paragraph
  graveyard/     graveyard page (html, ts, css, assets)
  popup/         toolbar popup
  options/       settings page
.kiro/           specs, steering, hooks (must stay committed)
LICENSE          MIT
```

- One module per concern; files under ~200 lines.
- Tests sit next to the code they test (`foo.ts` → `foo.test.ts`).
