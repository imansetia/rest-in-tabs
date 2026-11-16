# Requirements Document

## Introduction

Rest in Tabs is a Chrome/Edge extension that buries idle tabs in a spooky graveyard page. Burying a tab saves its address, title and a short summary, then closes it so the browser uses less memory. The user can resurrect any buried tab with one click. Nothing leaves the user's device.

## Glossary

- **Extension**: the Rest in Tabs browser extension.
- **Bury**: save a Grave for a tab, then close the tab.
- **Grave**: the saved record of one buried tab.
- **Epitaph**: a summary of the buried page, at most 200 characters, shown on its tombstone.
- **Graveyard**: the extension page that shows all Graves as tombstones.
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

### Requirement 2: Manual burial

**User Story:** As a user, I want to bury tabs on demand, so that I can clean up right now instead of waiting.

#### Acceptance Criteria

1. WHEN the user chooses "Bury this tab" in the Popup, THE Extension SHALL bury the current tab even if it is active, pinned or on the Protected Sites list; the restrictions in criterion 3 of this requirement (private window, non-http(s) address) still apply.
2. WHEN the user chooses "Bury idle tabs now" in the Popup, THE Extension SHALL immediately bury every tab that meets Requirement 1.2, regardless of whether Auto-Bury is enabled.
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

1. THE Graveyard SHALL show each Grave as a tombstone with its title, domain, icon, Epitaph and the time since burial.
2. THE Graveyard SHALL order tombstones from most recently buried to least recently buried.
3. WHEN the user types in the search field, THE Graveyard SHALL show only the Graves whose title, domain or Epitaph contains the typed text, ignoring letter case.
4. WHEN there are no Graves, THE Graveyard SHALL show a message that explains how tabs get buried.
5. WHEN a search matches no Graves, THE Graveyard SHALL show a "no graves match" message and a control that clears the search.
6. WHEN a Grave is added or removed while the Graveyard is open, THE Graveyard SHALL update without a page reload.

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

### Requirement 9: Haunting, accessible interface

**User Story:** As a user, I want the graveyard to feel spooky and polished while staying easy to use, so that visiting it is a pleasure and never an obstacle.

#### Acceptance Criteria

1. THE Graveyard SHALL present a graveyard scene with tombstones, fog and ambient motion.
2. WHILE the user's system requests reduced motion, THE Extension SHALL disable all non-essential animation.
3. THE Extension SHALL make every action reachable and operable with the keyboard, with a visible focus indicator.
4. THE Extension SHALL keep text contrast at WCAG 2.1 AA level or better.
5. THE Extension SHALL give every control an accessible name and announce the result of Resurrect and Exorcise to screen readers.
6. THE Graveyard SHALL remain usable at widths from 360 pixels to full desktop width.
