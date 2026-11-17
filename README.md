# Rest in Tabs

A Chrome and Edge extension that buries idle tabs in a graveyard, so the browser stays light and nothing is lost. Every buried tab becomes a tombstone with its title, a short epitaph and a cause of death, and one click resurrects it.

Built with [Kiro](https://kiro.dev) for Kiroween 2026 (Costume Contest).

- **Demo pages to bury:** <https://imansetia.github.io/rest-in-tabs/demo/>
- **Licence:** [MIT](LICENSE)

## Features

- **Automatic burial.** Tabs unused for longer than the Idle Threshold (3 hours by default) are buried once a minute. The active tab, pinned tabs, tabs playing sound, private windows, non-web pages and Protected Sites are never buried automatically. Tabs that were open when the extension was installed are left alone until they really go idle.
- **Manual burial.** "Bury N idle tabs" in the toolbar popup and the graveyard header, and "Bury this tab" in the popup.
- **The graveyard.** A night landscape with a moon, bare trees, drifting fog and an iron fence. The newest graves stand in front; older ones stand further back, smaller and deeper in fog. Every grave stays in the scene, clickable and searchable.
- **Tombstones that age.** Fresh (under a day), Weathered (1 to 7 days) and Crumbling (over a week): moss, cracks, cobwebs, a crow. The condition is also written in the plaque and the list.
- **Epitaphs and causes of death.** The epitaph is the page's own summary: its meta description, first paragraph or title. The cause of death is a dry one-liner: "Died of neglect. Unvisited for 3 days.", "Abandoned at checkout.", "Abandoned mid-draft.", "Abandoned during sign-up." or "Died a duplicate. 3 identical tabs were open."
- **Resurrect and Exorcise.** Resurrect reopens the page: a ghost with the site's icon as its eyes rises into warm light and flies off toward the tab bar. Exorcise deletes a grave for good, after a confirmation: lightning, bats, and the stone sinks into the ground.
- **Search and List view.** Search by title, site or epitaph; the view glides to the newest match. The List view is a sortable table with the same search.
- **On-device AI epitaphs (optional).** Where the browser's built-in Summarizer is available, epitaphs are rewritten as one plain sentence, on the device.
- **Settings.** Auto-Bury, Idle Threshold, Protected Sites, how long graves are kept (1 to 365 days, or never), and a Demo clock that moves the graveyard's displayed time forward by up to 14 days, to show how stones decay.
- **Night and Dusk.** Two dark themes; Dusk is the default on a light system.
- **Accessible.** Every action works with the keyboard and shows a focus ring. Animations become short fades under "reduce motion". Text meets WCAG AA in both themes, and the layout works from 360 px wide.

## Install

### From the release zip

1. Download `rest-in-tabs.zip` from the [latest release](https://github.com/imansetia/rest-in-tabs/releases/latest) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Choose **Load unpacked** and select the unzipped folder (the one that contains `manifest.json`).

Requires Chrome or Edge 121 or later. The AI epitaphs need Chrome or Edge 138 or later on supported hardware.

### From source

Requires Node.js 22.12 or later.

```
npm install
npm test          # 345 unit and property-based tests
npm run build     # builds the extension into dist/
npm run zip       # builds dist/ and packs it as rest-in-tabs.zip
```

Then load the `dist` folder with **Load unpacked**, as above.

## Try it with the demo pages

The [demo pages](https://imansetia.github.io/rest-in-tabs/demo/) are small static pages, one for each kind of grave: a recipe, flights, a shopping cart, a half-written memo, a sign-up form, a forum question to open three times, and more. Each has its own icon and a written epitaph. Open a few, then use "Bury this tab" or "Bury N idle tabs" (with a short Idle Threshold) and visit the graveyard.

## Privacy

- **No requests outside the extension.** The extension pages load only their own files: fonts are bundled, and site icons come from the browser's own favicon store (`_favicon`), never from a third-party service. A content security policy enforces this.
- **Nothing leaves the device.** Graves, settings and statistics live in `chrome.storage.local`. There is no account, no backend and no telemetry.
- **On-device AI only.** Epitaphs are rewritten with the browser's built-in Summarizer, which runs on the device. Page text is never sent to a server. If the Summarizer is not available, the page's own summary stays.

Permissions: `tabs` and `alarms` to find and bury idle tabs, `scripting` with access to all sites to read a page's title, meta description and first paragraph when it is buried, `storage` for the graves, and `favicon` for the site icons.

### A note on the Chrome Summarizer warning

On some devices Chrome reports the Summarizer as "unavailable" and logs this warning each time the graveyard checks it:

> The model was available but there was not an execution config available for the feature.

This comes from the browser, not from the extension. The graveyard then keeps the page's own summary as the epitaph, as designed.

## How Kiro was used

The product and design ideas are mine. Claude (Anthropic) built the [interactive mockup](design/mockup.html) from those ideas and reviewed each finished task. Kiro wrote all of the code, from the spec, one task at a time.

- **Spec-driven development.** [Requirements](.kiro/specs/rest-in-tabs/requirements.md), [design](.kiro/specs/rest-in-tabs/design.md) and [tasks](.kiro/specs/rest-in-tabs/tasks.md) were written and revised in Kiro's spec workflow, and the extension was built task by task, with a review after each.
- **Steering.** [Product](.kiro/steering/product.md), [tech](.kiro/steering/tech.md), [structure](.kiro/steering/structure.md) and [design](.kiro/steering/design.md) steering files fix the rules for every change: pure decision logic in `src/core/`, `chrome.*` only through `src/platform/`, the colour tokens, the copy tone, the motion and the accessibility rules.
- **Hooks.** [Agent hooks](.kiro/hooks/) run the related tests when a source file is saved, check user-facing copy against the steering's tone rules, and check that the tasks, requirements and code still agree.
- **Property-based tests.** All decision logic is tested with [fast-check](https://fast-check.dev/), for example burial selection, decay stages, cause of death, search, the landscape layout and the Demo clock. See the `*.test.ts` files next to the code in [`src/core/`](src/core/).

## Credits

- Fonts, bundled under the [SIL Open Font License 1.1](https://openfontlicense.org/) (licence files ship with the extension):
  - [Pirata One](src/assets/fonts/pirata-one/OFL.txt) by Rodrigo Fuenzalida and Nicolas Massi
  - [Cinzel](src/assets/fonts/cinzel/OFL.txt) by The Cinzel Project Authors
  - [Cormorant Garamond](src/assets/fonts/cormorant-garamond/OFL.txt) by the Cormorant Project Authors
  - [Inter](src/assets/fonts/inter/OFL.txt) by The Inter Project Authors
- The demo page for "The Fall of the House of Usher" quotes the opening of Edgar Allan Poe's story (1839), which is in the public domain.

## Licence

[MIT](LICENSE)
