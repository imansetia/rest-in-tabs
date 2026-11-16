# Implementation Plan

Tasks marked `*` are optional and can be skipped for a faster first version.

- [x] 1. Set up the project
  - Create `manifest.json` (MV3) with `tabs`, `storage`, `alarms`, `scripting` and `<all_urls>` host permission
  - Configure Vite + TypeScript strict to build service worker, graveyard, popup and options entries
  - Add Vitest and fast-check; add `npm test` and `npm run build`
  - Add MIT `LICENSE` and a README stub with load-unpacked instructions
  - _Requirements: 1.1, 3.6_

- [x] 2. Define data models and settings
  - [x] 2.1 Create `src/core/types.ts` with `TabInfo`, `PageInfo`, `Grave`, `Settings`, `Stats` and constants
    - _Requirements: 3.1, 8.1_
  - [x] 2.2 Implement `normalizeSettings` and `validateSetting`
    - _Requirements: 8.1, 8.3_
  - [x] 2.3 Write property test for settings
    - **Property 10: Settings are always in range**
    - **Validates: Requirements 8.1, 8.3**

- [ ] 3. Implement tab selection
  - [x] 3.1 Implement `isProtected` (including subdomain matching), `canBuryManually` and `selectBurialCandidates`
    - _Requirements: 1.2, 1.3, 1.6, 2.2_
  - [x] 3.2 Write property tests for selection
    - **Property 1: Protected tabs are never selected**
    - **Property 2: Selection is exactly the idle, unprotected tabs**
    - **Property 3: Auto-Bury off selects nothing**
    - **Validates: Requirements 1.2, 1.3, 1.6, 2.2**

- [x] 4. Implement graves and epitaphs
  - [x] 4.1 Implement `fallbackEpitaph` with source order meta → paragraph → title and 200-character limit
    - _Requirements: 3.2, 3.3, 3.7_
  - [x] 4.2 Implement `addGrave` with deduplication by address and the 2,000 cap
    - _Requirements: 3.8, 6.5_
  - [x] 4.3 Write property tests for graves and epitaphs
    - **Property 4: Graves stay unique and capped**
    - **Property 5: Burial preserves the address**
    - **Property 6: Epitaphs are always valid**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.7, 3.8, 5.1, 6.5**

- [x] 5. Implement decay, expiry, search and stats
  - [x] 5.1 Implement `decayStage`, `expiredGraves`, `sortGraves`, `searchGraves`, `estimateFreedMb`
    - _Requirements: 4.2, 4.3, 6.1, 6.3, 6.4, 7.1_
  - [x] 5.2 Write property tests
    - **Property 7: Decay never reverses**
    - **Property 8: Expiry removes only old Graves**
    - **Property 9: Search returns matching Graves only**
    - **Validates: Requirements 4.3, 6.1, 6.3, 6.4**

- [x] 6. Checkpoint: all core tests pass
  - Run `npm test`; ask the user if anything is unclear before touching `chrome.*`.

- [ ] 7. Build the platform adapters
  - [x] 7.1 `platform/storage.ts`: typed get/set for graves, settings, stats and an `onChanged` subscription
    - _Requirements: 7.3, 8.4_
  - [ ] 7.2 `platform/tabs.ts`: query → `TabInfo[]`, remove, create
    - _Requirements: 1.2, 5.1_
  - [ ] 7.3 `platform/extract.ts`: read title, meta description, first paragraph and excerpt with a 2-second timeout
    - _Requirements: 3.2, 3.7_

- [ ] 8. Build the service worker
  - [ ] 8.1 Register the one-minute `bury-check` alarm on install and startup
    - _Requirements: 1.1_
  - [ ] 8.2 Implement the burial flow: select → extract → `createGrave` → `addGrave` → save → close, in a single queue, closing the tab only after the save succeeds
    - _Requirements: 1.2, 1.4, 1.5, 3.1_
  - [ ] 8.3 Implement expiry on each alarm and the `buryTab`, `buryIdle`, `resurrect`, `exorcise` message handlers, updating stats. The `buryIdle` handler calls `selectBurialCandidates` with `autoBury` forced to `true` so "Bury idle tabs now" works even when Auto-Bury is disabled.
    - _Requirements: 2.1, 2.2, 5.1, 5.2, 5.4, 6.3, 7.1_
  - [ ] 8.4 Write orchestration tests with fake adapters
    - Save fails → tab is not closed; create fails → Grave is kept
    - `buryIdle` buries idle tabs even when `settings.autoBury` is false
    - _Requirements: 1.5, 2.2, 5.2_

- [ ] 9. Build the Popup
  - Grave count, "Bury this tab" (disabled with reason when not allowed), "Bury idle tabs now", "Open graveyard"
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 10. Build the Graveyard page
  - [ ] 10.1 Render tombstones (title, domain, icon, Epitaph, time since burial, decay label), newest first, with live updates from storage
    - _Requirements: 4.1, 4.2, 4.6, 6.2_
  - [ ] 10.2 Add search, empty state and no-match state with a clear-search control
    - _Requirements: 4.3, 4.4, 4.5_
  - [ ] 10.3 Add Resurrect and Exorcise (with confirmation), error message on failure, and screen-reader announcements
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.5_
  - [ ] 10.4 Add the stats bar with the memory figure labelled as an estimate
    - _Requirements: 7.1, 7.2_

- [ ] 11. Apply the haunting theme
  - [ ] 11.1 Graveyard scene: night sky, layered fog, three tombstone styles for the decay stages, candle flicker, a "rising" animation on Resurrect
    - _Requirements: 9.1, 6.2_
  - [ ] 11.2 Accessibility pass: reduced-motion media query, visible focus, keyboard order, AA contrast, layout from 360 px
    - _Requirements: 9.2, 9.3, 9.4, 9.6_

- [ ] 12. Build the Options page
  - Auto-Bury toggle, Idle Threshold, Protected Sites editor, Retention Period; inline range errors; changes apply on the next check
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 13. Add on-device AI epitaphs
  - [ ] 13.1 Implement `platform/summarizer.ts`: `checkAvailability()` wrapping `Summarizer.availability()`, and `createAndSummarize(text)` wrapping `Summarizer.create()` + `.summarize()` with `downloadprogress` callback
    - _Requirements: 3.4, 3.5_
  - [ ] 13.2 On Graveyard load, call `checkAvailability()`:
    - `"available"` → iterate Graves with an excerpt, call `createAndSummarize`, save updated Epitaph (`epitaphSource: "ai"`), delete excerpt
    - `"downloadable"` → render "Enable AI epitaphs" button; on click call `createAndSummarize` (triggers download), show progress, then upgrade Epitaphs as above
    - `"downloading"` / `"unavailable"` → do nothing; fallback Epitaph stays
    - _Requirements: 3.4, 3.5_
  - [ ] 13.3 Add excerpt pruning in the service-worker alarm handler (separate step from `expiredGraves`): remove `excerpt` from any Grave where `now - buriedAt > 7 * 24 * 60 * 60 * 1000`  
    - _Requirements: 3.4_

- [ ] 14. Checkpoint: full manual test
  - Load unpacked in Chrome and Edge; run the manual checks from the design's Testing Strategy; ask the user about anything that fails.

- [ ]* 15. Demo helpers
  - A "demo mode" setting that sets the Idle Threshold to 10 seconds for the video
  - Sound effects toggle (off by default)

- [ ] 16. Prepare the submission
  - Finish README (features, install, how Kiro was used: specs, steering, hooks, property-based tests)
  - Confirm `.kiro/` is committed and not in `.gitignore`; confirm the license shows in the repo About section
  - Build a release zip and attach it to a GitHub release as the testable build
