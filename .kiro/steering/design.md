---
inclusion: always
---

# Design: the graveyard

The visual reference is `design/mockup.html`. Open it and copy values from it; do not invent new ones. This file writes down the rules behind it. When the two disagree, ask.

## Mood

Dark gothic comedy: Tim Burton's palette with Pixar's heart (Corpse Bride, Sleepy Hollow, Coco). Mysterious and dry, never gory, never cute. Scale: 7 out of 10.

- **Cold always wins.** Moonlight blue, fog grey, bone white. The only warm light on the page is amber and marigold, and it appears only while a tab is being resurrected. Death is cold; coming back is warm.
- **Always night.** The theme switch is Night / Dusk, never Light / Dark. Dusk is a slightly lighter dark variant, not a white page. Default: Dusk when the system prefers light, otherwise Night.
- **Never:** neon or cyberpunk, blood or gore, jump scares, cute cartoon, meme humour, purple gradients, glassmorphism, rows of identical cards, text too dark to read.

## Colour tokens

Defined as CSS custom properties on `:root`, overridden under `[data-theme="dusk"]`.

| Token | Night | Dusk | Use |
|---|---|---|---|
| `--sky-1` | `#03050b` | `#121a2b` | page background, top of sky |
| `--sky-2` | `#0a1222` | `#222c42` | mid sky |
| `--sky-3` | `#15233a` | `#3a4561` | horizon |
| `--hill-far` / `--hill-near` | `#0c1424` / `#080d17` | `#1a2336` / `#121a29` | hills |
| `--ground` | `#070a10` | `#0f1520` | ground |
| `--stone-1` / `--stone-2` | `#4b5361` / `#343b47` | `#5c6474` / `#464d5b` | tombstone gradient |
| `--panel` / `--panel-2` | `#0c121d` / `#121a28` | `#151d2c` / `#1c2638` | plaque, popup, inputs |
| `--line` | `#2b3444` | `#3a4559` | borders |
| `--fog` | `190 202 216` (RGB) | same | fog, always used with alpha |
| `--bone` / `--bone-dim` | `#ece6d8` / `#b8b2a4` | same | text on stone, headings |
| `--text` / `--muted` | `#e7e2d6` / `#a7adba` | same | body text |
| `--spectral` / `--spectral-dim` | `#a9ecd1` / `#6bbf9f` | same | focus ring, primary button, hover glow |
| `--amber` / `--marigold` | `#ffb547` / `#ff9a1f` | same | resurrect only |
| `--danger` | `#e6b4b4` | same | Exorcise button text |

Text must meet WCAG AA on its background. Check every new pairing.

## Typography

All fonts are bundled with the extension under `src/assets/fonts/` with their OFL licence files. Never load fonts from the network.

| Role | Font | Notes |
|---|---|---|
| Logo, grave names, plaque / popup / dialog titles | Pirata One 400 | blackletter, letter-spacing ~0.01em |
| Dates on stones | Cinzel 400–600, capitals | spaced like carved numerals, `15 NOV — 17 NOV` |
| Epitaphs, tagline, empty states | Cormorant Garamond italic 500 | elegant; the dry lines need grace, not shouting |
| Everything else (body, buttons, labels) | Inter 400–600 | plain and readable at small sizes |

The primary "Bury N idle tabs" button uses Cinzel capitals with the spectral outline.

## Copy

English only. Buttons and error messages are plain and literal, with no exceptions. The humour lives in data, written as a flat one-line obituary.

- No exclamation marks, no puns on death or RIP, no memes, no emoji, never address the reader.
- Good: "Died of neglect. Unvisited for 3 days." Bad: "RIP little tabby! You died doing what you loved 😢".
- The **epitaph** is the factual page summary. The **cause of death** carries the dry humour.
- One line each for the title area and empty states:
  - Tagline: "Final resting place of tabs that were going to be read later."
  - No graves: "Nothing has died here yet. Give it time."
  - Search with no match: "No grave bears that name." plus a "Clear search" button.
- Memory figure: `≈ 2.3 GB freed (estimated)`. Always the word "estimated", decimal point, MB below 1,000 MB.
- Time since burial: "just now" under one hour, otherwise "5 hours ago", "3 days ago", "2 months ago" (same units as the cause of death).
- If the idle count cannot be read yet, the button reads "Bury idle tabs" and stays usable.
- Toasts: "Reopened in a new tab.", "Grave deleted permanently.", "Buried 12 idle tabs." / "Buried 1 idle tab." (Bury idle tabs), "Tab buried." (Bury this tab).

### Cause of death

A pure function in `src/core`. It picks the first rule that matches; it never invents text.

1. **Duplicate**: more than one open tab had the same URL at burial. "Died a duplicate. N identical tabs were open."
2. **Abandoned at checkout**: path contains `cart` or `checkout`. "Abandoned at checkout."
3. **Abandoned mid-draft**: a path segment is exactly `edit`, `draft` or `compose` (so `/document/d/1x9/edit` counts, `/editor` does not). "Abandoned mid-draft."
4. **Abandoned during sign-up**: path contains `register`, `signup`, `sign-up` or `join`. "Abandoned during sign-up."
5. **Neglect** (default): "Died of neglect. Unvisited for D." where D is `buriedAt - lastAccessed`: "less than an hour" below 1 h, then hours below 48 h, days below 60 days, then months.

## The landscape (default view)

Layers from back to front: sky with a few stars, full moon (top right, soft blue glow), far and near hills, three bare trees, drifting fog bands, the graves, a low iron fence along the bottom edge with one crow on it.

**Rows.** Graves are sorted newest first. The newest stand in the front row; older ones stand further back, smaller and deeper in fog.

- Base plot: 172 × 236 px, stone 196 px tall, scaled by the row factor `s`.
- Row scales `s`: 1, 0.78, 0.62, 0.5, 0.41, 0.34. Fog veil per row: 0, 0.26, 0.5, 0.68, 0.8, 0.86.
- The front row sits 58 px above the bottom. Each next row sits `236 × s × 0.7` px higher (`s` of the row in front). Before adding row `i > 0` at height `bottom`, stop if `bottom + 236 × s_i × 0.55 > 0.8 × sceneHeight`; the last row added holds the rest. (Same rule as `renderLandscape` in the mockup.)
- Front row capacity: `floor((width − 40) / 202)`, at least 2. Row `i` holds `max(front, floor(front / s) + i)`. A last row with fewer than 3 graves joins the row in front of it.
- Farther rows: darker, less saturated, slightly blurred, and covered by a fog veil. **The front row is always clear.**
- Small deterministic jitter (tilt, vertical offset) from a hash of the grave id, so the yard looks placed by hand but stays stable between renders.

**A tombstone shows**, top to bottom: favicon in a small round medallion, name (Pirata One, up to 2 lines), dates "last visited — buried", epitaph (Cormorant italic, up to 3 lines), cause of death (Inter, small, up to 2 lines). Each stone is a `<button>` whose accessible name is "Title. Condition. Buried 5 hours ago."

**Favicon.** Load it from Chrome's `_favicon` endpoint with `pageUrl` set to the grave's URL (extension origin, no network request). Show the first letter of the domain underneath it on a muted colour disc, so a missing or broken icon still shows the letter.

### Decay stages

| Stage | Age | Look |
|---|---|---|
| Fresh | under 24 hours | dark new soil mound, upright stone, one black rose beside it |
| Weathered | 1 to 7 days | moss patches, tilted a few degrees, a crack, a cobweb in the corner, letters at about 78% opacity |
| Crumbling | over 7 days | broken jagged top, double tilt, heavy moss, weeds at the base, sometimes a fallen cross beside it, about a third have a crow perched on top, letters at about 42% opacity (nearly unreadable; the plaque and list always show the full text) |

The condition is also shown as a text label ("Fresh", "Weathered", "Crumbling") in the plaque and the list, never by look alone.

## Interactions

**Plaque (grave details).** Clicking a stone opens a plaque at the bottom of the scene: title, domain, epitaph, cause of death, last visited, buried (date and "x ago"), condition, and two buttons, **Resurrect** (primary) and **Exorcise**. It closes with ×, with Esc, or with a click anywhere outside it. Clicking another stone switches the plaque to that grave. Clicks inside the confirm dialog do not close it. Focus moves to Resurrect on open and back to the stone on close with × or Esc.

**Search.** Matches title, domain or epitaph, ignoring case and surrounding spaces, 180 ms after typing stops. The fog thins, non-matching graves fade to about 28%, matching graves lose their veil, and the view glides (1.1 s) toward the first match, enlarging it up to 1.9× so a far grave comes forward. Clearing the search resets the view.

**List view.** A switch Landscape / List. The list is a table: tab (favicon, title, domain), epitaph, cause of death, buried ("x ago", full date on hover), condition, actions (Resurrect, Exorcise). Sort: newest first, oldest first, name. It carries all serious searching; the landscape is for atmosphere.

**Demo clock.** Only when the Demo setting is on. It shifts the time the Graveyard *displays* with: decay stages and every "x ago" text move together, so a Crumbling stone never says "Buried 2 hours ago". It never changes burial, expiry, statistics or stored data, and the offset is not saved.

**Bury idle tabs.** The button shows the count: "Bury 12 idle tabs", or "No idle tabs to bury" when there are none (then unavailable). It appears in both the graveyard header and the popup and does the same thing.

## Motion

Every animation below is turned off or replaced by a short fade under `prefers-reduced-motion: reduce`. Ambient motion: fog drifts slowly (55 to 90 s per loop). Nothing else moves at rest.

**Resurrect: up into warm light** (about 3 s):
1. Amber glow opens in the ground under the stone (0.65 s). This is the only warm light on the page.
2. The stone slides aside and tips (0.5 s).
3. A white sheet ghost rises out of the grave with the site's favicon as its two eyes. Marigold petals burst outward and fall (1.3 to 2.1 s).
4. The ghost flies off the top edge of the page, toward the tab bar (0.8 s). Then the tab opens.
5. The plot becomes fresh, empty soil. The grave is gone because the tab lives again.

**Exorcise: down into the dark** (permanent, so it is heavier):
1. Confirm dialog first: "Exorcise this grave?" / "“Title” will be deleted permanently. This cannot be undone." Buttons "Keep it" (default focus) and "Exorcise".
2. A moment of silence: the scene dims and the fog stops (0.8 s).
3. One lightning strike from the top of the sky to the stone, with a flash limited to the scene.
4. Bats scatter upward, the stone sinks into the ground (1.1 s).
5. The plot becomes bare ground. The crow on the fence calls once (a head movement; there is no sound unless sound is on).

**Mass burial** (the demo moment):
1. Fog rolls in thick (0.9 s).
2. New graves rise out of the ground one by one, newest first, 170 ms apart, front row first.
3. The buried count and the memory estimate count up.
4. A crow flies across the moon. The fog recedes.

## Popup

320 px wide, the same tokens as the graveyard. An iron fence strip along the top. Ghost mascot (friendly, not scary) beside "Rest in Tabs" and "N tabs at rest". Primary button "Bury N idle tabs", secondary "Bury this tab" (unavailable with its reason on private windows and non-web pages), then "Last buried" with the newest epitaph, then the link "Open the graveyard". The popup is a tool, not a page: one main action, visible at once.

## Sound

Off by default. When turned on: wind through dead trees, a distant owl, a crow call once on burial, a soft rising tone (harp or slow theremin) on resurrect, a low cello drone as ambience. No jump-scare stingers.

## Accessibility

- Every action works with the keyboard and has a visible focus ring (`--spectral`).
- Status messages (toasts) are announced through a polite live region.
- Decorations (moon, trees, fog, crows, rose, cracks) are hidden from screen readers.
- The layout works from 360 px wide. On narrow screens the list view is the comfortable path.
