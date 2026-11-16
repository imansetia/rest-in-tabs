# Requirements Document

## Introduction

Rest in Tabs is a Chrome/Edge extension that buries idle tabs in a spooky graveyard page. Burying a tab saves its address, title and a short summary, then closes it so the browser uses less memory. The user can resurrect any buried tab with one click. Nothing leaves the user's device.

## Glossary

- **Extension**: the Rest in Tabs browser extension.
- **Bury**: save a Grave for a tab, then close the tab.
- **Grave**: the saved record of one buried tab.
- **Epitaph**: a summary of the buried page, at most 200 characters, shown on its tombstone.
- **Graveyard**: the extension page that shows all Graves, as tombstones in the Landscape view or as rows in the List view.
- **Landscape view**: the default Graveyard view, a night scene with Graves standing in rows.
- **List view**: a table of all Graves, meant for searching and sorting.
- **Plaque**: the details panel that opens at the bottom of the scene when the user selects a tombstone.
- **Cause of death**: a one-line obituary for a Grave, chosen by fixed rules from stored data (see Requirement 10).
- **Duplicate count**: the number of open tabs, including the buried one, that had the Grave's address at burial time.
- **Theme**: the colour variant of the extension pages, Night or Dusk. Both are dark.
- **Demo clock**: a Graveyard control, shown only when the Demo setting is on, that moves the time the Graveyard displays with forward.
- **Resurrect**: reopen a Grave's page in a new tab and remove the Grave.
- **Exorcise**: permanently delete a Grave without reopening it.
- **Idle Threshold**: how long a tab must go unused before it can be buried automatically.
- **Protected Sites**: a user-managed list of domains whose tabs are never buried automatically.
- **Protected Tab**: a tab that must never be buried automatically (see Requirement 1.3).
- **Retention Period**: how long a Grave is kept before it is removed automatically.
- **Popup**: the small window opened from the extension's toolbar icon.

## Requirements

### Requirement 1: Automatic burial of idle tabs

**User Story:** As a person with too many open tabs, I want unused tabs to be put away automatically, so that my browser stays fast without me deciding what to close.

#### Acceptance Criteria

1. WHILE Auto-Bury is enabled, THE Extension SHALL check all open tabs at least once every minute.
2. WHEN a check runs and a tab has been unused for at least the Idle Threshold and is not a Protected Tab, THE Extension SHALL bury that tab.
3. THE Extension SHALL treat a tab as a Protected Tab when it is the active tab of any window, is pinned, is playing audio, is in a private (incognito) window, has an address that does not start with `http://` or `https://`, or belongs to a domain on the Protected Sites list.
4. WHEN the Extension buries a tab, THE Extension SHALL save the Grave before it closes the tab.
5. IF saving the Grave fails, THEN THE Extension SHALL leave the tab open.
6. WHILE Auto-Bury is disabled, THE Extension SHALL NOT bury any tab automatically.
7. FOR automatic burial only, THE Extension SHALL measure a tab's idleness from the later of the tab's last use and the time the extension was installed, so that installing the extension never buries existing tabs immediately. Manual burial (Requirement 2) uses the tab's actual last-use time.

### Requirement 2: Manual burial

**User Story:** As a user, I want to bury tabs on demand, so that I can clean up right now instead of waiting.

#### Acceptance Criteria

1. WHEN the user chooses "Bury this tab" in the Popup, THE Extension SHALL bury the current tab even if it is active, pinned or on the Protected Sites list, and SHALL show "Tab buried."; the restrictions in criterion 3 of this requirement (private window, non-http(s) address) still apply.
2. THE Popup and the Graveyard SHALL each show a "Bury N idle tabs" button, where N is the number of tabs it would bury at that moment (see Requirement 4.10). WHEN the user chooses it, THE Extension SHALL immediately bury every tab that meets Requirement 1.2, regardless of whether Auto-Bury is enabled, and SHALL show "Buried 1 idle tab." or "Buried N idle tabs."
3. IF the current tab is in a private window or its address does not start with `http://` or `https://`, THEN THE Popup SHALL disable "Bury this tab" and show the reason.
4. THE Popup SHALL show the number of Graves and a link that opens the Graveyard.

### Requirement 3: Graves and epitaphs

**User Story:** As a user, I want each buried tab to keep enough information to recognise it later, so that I can find the page I need without reopening everything.

#### Acceptance Criteria

1. THE Extension SHALL store in each Grave the page address, title, icon address, domain, time of burial, time of last use, and Epitaph.
2. WHEN the Extension buries a tab, THE Extension SHALL write the Epitaph from the first of these that is available: the page's meta description, the page's first paragraph, the page title.
3. THE Extension SHALL keep every Epitaph non-empty and at most 200 Unicode code points long.
4. WHERE the browser's Summarizer API (available in Chrome and Edge 138+) reports availability status `"available"`, THE Graveyard SHALL automatically replace the Grave's Epitaph with an AI-generated summary produced from the stored text excerpt, then delete the excerpt.
5. WHERE the Summarizer API reports availability status `"downloadable"`, THE Graveyard SHALL show an "Enable AI epitaphs" button; WHEN the user clicks it, THE Graveyard SHALL initiate the model download and, once complete, upgrade Epitaphs as in criterion 4.
6. THE Extension SHALL NOT send page content, addresses or titles to any remote server.
7. IF the page text cannot be read within 2 seconds, THEN THE Extension SHALL use the page title as the Epitaph and still bury the tab.
8. WHEN the Extension buries a tab whose address already has a Grave, THE Extension SHALL update the existing Grave instead of creating a second one.

### Requirement 4: Graveyard page

**User Story:** As a user, I want to browse and search my buried tabs, so that I can quickly find one I want back.

#### Acceptance Criteria

1. WHEN the Graveyard opens, THE Graveyard SHALL show the Landscape view, where each Grave is a tombstone showing, from top to bottom: its icon, its title (up to 2 lines), the dates "last visited — buried", its Epitaph (up to 3 lines) and its Cause of death (up to 2 lines). Each tombstone SHALL be a button whose accessible name is the title, the decay stage and the time since burial, for example "Title. Fresh. Buried 5 hours ago."
2. THE Landscape view SHALL place the most recently buried Graves in the front row and older Graves in rows further back, smaller and deeper in fog. The front row SHALL never be covered by fog.
3. THE Graveyard SHALL offer a Landscape / List switch. The List view SHALL be a table with, for each Grave: icon, title and domain; Epitaph; Cause of death; time since burial (with the full date on hover); decay stage; and Resurrect and Exorcise buttons. The List view SHALL sort by newest first (default), oldest first, or name.
4. WHEN the user types in the search field, THE Graveyard SHALL, 180 ms after typing stops, match Graves whose title, domain or Epitaph contains the typed text, ignoring letter case and surrounding spaces. In the List view only matching rows SHALL be shown. In the Landscape view the fog SHALL thin, non-matching Graves SHALL fade, and the view SHALL move toward the first match and enlarge it. WHEN the search is cleared, THE Landscape view SHALL return to its normal state.
5. WHEN there are no Graves, THE Graveyard SHALL show "Nothing has died here yet. Give it time."
6. WHEN a search matches no Graves, THE Graveyard SHALL show "No grave bears that name." and a "Clear search" button.
7. WHEN a Grave is added or removed while the Graveyard is open, THE Graveyard SHALL update without a page reload.
8. WHEN the user selects a tombstone, THE Graveyard SHALL open the Plaque with the Grave's title, domain, Epitaph, Cause of death, last visited date, burial date with time since burial, decay stage, and Resurrect and Exorcise buttons, and SHALL move focus to Resurrect. Selecting another tombstone SHALL switch the Plaque to that Grave.
9. THE Plaque SHALL close when the user presses its close button, presses Esc, or clicks anywhere outside it. Clicks inside the Exorcise confirmation SHALL NOT close it. WHEN it closes by the close button or Esc, focus SHALL return to the tombstone that opened it.
10. THE "Bury N idle tabs" button (Requirement 2.2) SHALL appear in the Graveyard header as well as the Popup and do the same thing in both. N SHALL be computed by the service worker with the same selection that the burial itself uses. WHEN N is 0, the button SHALL read "No idle tabs to bury" and be unavailable.
11. WHEN a Resurrect completes, THE Landscape view SHALL show the Grave's plot as empty fresh soil, and WHEN an Exorcise completes, as bare ground, until the Landscape view is next re-rendered.
12. THE Graveyard SHALL show each Grave's icon from the browser's own favicon store for the Grave's address (Chrome's `_favicon` endpoint with `pageUrl` set to the Grave's address), with the first letter of its domain on a muted disc underneath, so a missing or broken icon still shows the letter. THE Extension SHALL NOT use a third-party icon service.

### Requirement 5: Resurrect and exorcise

**User Story:** As a user, I want to bring a buried tab back or delete it for good, so that I stay in control of what is kept.

#### Acceptance Criteria

1. WHEN the user chooses Resurrect on a tombstone, THE Extension SHALL open the Grave's address in a new tab and then remove the Grave.
2. IF the new tab cannot be opened, THEN THE Extension SHALL keep the Grave and show an error message.
3. WHEN the user chooses Exorcise on a tombstone, THE Extension SHALL ask for confirmation before it deletes the Grave.
4. WHEN the user confirms Exorcise, THE Extension SHALL permanently delete the Grave.

### Requirement 6: Decay and expiry

**User Story:** As a user, I want old graves to visibly age and eventually disappear, so that the graveyard does not grow forever.

#### Acceptance Criteria

1. THE Extension SHALL assign each Grave a decay stage from its age: Fresh for less than 1 day, Weathered for 1 day up to 7 days, Crumbling for more than 7 days.
2. THE Graveyard SHALL show the decay stage of each tombstone through both its appearance and a text label.
3. WHEN a Grave becomes older than the Retention Period, THE Extension SHALL remove it automatically.
4. WHERE the Retention Period is set to "Never", THE Extension SHALL NOT remove Graves automatically because of age.
5. WHEN adding a Grave would bring the total above 2,000, THE Extension SHALL remove the oldest Graves first until the total is 2,000.

### Requirement 7: Statistics

**User Story:** As a user, I want to see what the extension has done for me, so that I know it is worth keeping.

#### Acceptance Criteria

1. THE Graveyard SHALL show the total number of tabs buried, the total number resurrected, and the estimated memory freed.
2. THE Graveyard SHALL label the memory figure as an estimate.
3. THE Extension SHALL keep the statistics across browser restarts.

### Requirement 8: Settings

**User Story:** As a user, I want to tune how aggressive the extension is, so that it fits the way I work.

#### Acceptance Criteria

1. THE Extension SHALL let the user set Auto-Bury on or off (default on), the Idle Threshold from 5 minutes to 7 days (default 3 hours), the Protected Sites list (default empty), and the Retention Period from 1 to 365 days or "Never" (default 30 days).
2. WHEN the user changes a setting, THE Extension SHALL apply it from the next check without a browser restart.
3. IF the user enters a value outside the allowed range, THEN THE Extension SHALL reject it and show the allowed range.
4. THE Extension SHALL keep the settings across browser restarts.
5. THE Extension SHALL offer a Demo setting, off by default. WHILE it is on, THE Graveyard SHALL show the Demo clock, which moves the time the Graveyard displays with forward by 0 to 14 days. WHILE it is off, the Demo clock SHALL be hidden and the Graveyard SHALL display with the real time.
6. THE Demo clock SHALL move decay stages (Requirement 6.1) and every time-since text (such as "Buried 5 hours ago") together. It SHALL NOT change burial, expiry, statistics or any stored data, and its offset SHALL NOT be saved.

### Requirement 9: Haunting, accessible interface

**User Story:** As a user, I want the graveyard to feel spooky and polished while staying easy to use, so that visiting it is a pleasure and never an obstacle.

#### Acceptance Criteria

1. THE Landscape view SHALL present a night scene with a starry sky, a full moon, hills, bare trees, drifting fog, the Graves and a low iron fence with a crow, as described in the design steering file. At rest only the fog SHALL move. Resurrect, Exorcise and mass burial SHALL each have their own animation as described in the design steering file; warm amber light SHALL appear only during Resurrect.
2. WHILE the user's system requests reduced motion, THE Extension SHALL turn off every animation or replace it with a short fade.
3. THE Extension SHALL make every action reachable and operable with the keyboard, with a visible focus indicator.
4. THE Extension SHALL keep text contrast at WCAG 2.1 AA level or better.
5. THE Extension SHALL give every control an accessible name and announce the result of Resurrect and Exorcise to screen readers.
6. THE Graveyard SHALL remain usable at widths from 360 pixels to full desktop width.
7. THE Graveyard SHALL offer a Night / Dusk theme switch. WHEN no choice has been made, THE Extension SHALL use Dusk if the system prefers a light colour scheme and Night otherwise. THE Extension SHALL remember the user's choice on this device and apply it to all extension pages.
8. THE Extension SHALL bundle the fonts Pirata One, Cinzel, Cormorant Garamond and Inter under `src/assets/fonts/`, each with its OFL licence file.
9. Extension pages SHALL make no network requests.

### Requirement 10: Cause of death

**User Story:** As a user, I want each grave to say briefly why the tab died, so that the graveyard is fun to read and reminds me what I left unfinished.

#### Acceptance Criteria

1. THE Extension SHALL compute each Grave's Cause of death from stored data with the fixed rules in criterion 3. It SHALL NOT generate, invent or randomise the text.
2. WHEN the Extension buries a tab, THE Extension SHALL store in the Grave its Duplicate count: the number of open tabs, including the buried one, whose address equalled the buried tab's address at that moment.
3. THE Extension SHALL use the first rule that matches, checking the path of the Grave's address without regard to letter case:
   1. Duplicate count greater than 1: "Died a duplicate. N identical tabs were open." where N is the Duplicate count.
   2. Path contains `cart` or `checkout`: "Abandoned at checkout."
   3. Path contains `/edit`, `/draft` or `/compose`: "Abandoned mid-draft."
   4. Path contains `register`, `signup`, `sign-up` or `join`: "Abandoned during sign-up."
   5. Otherwise: "Died of neglect. Unvisited for D." where D is the time from last use to burial: "less than an hour" below 1 hour, then in hours below 48 hours, in days below 60 days, and in months from then on.
4. IF a Grave has no stored Duplicate count (for example, it was buried before this field existed), THEN THE Extension SHALL treat its Duplicate count as 1.
5. THE Graveyard SHALL show the Cause of death on the tombstone, in the Plaque and in the List view.
