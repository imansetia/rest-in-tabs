# Demo pages (for the video and for judges)

Small static pages that Rest in Tabs can bury, so the demo shows every cause of death, readable epitaphs and colourful icons without any third-party brand. Published with GitHub Pages from the `docs/` folder of this repo:

`https://imansetia.github.io/rest-in-tabs/demo/…`

## Rules for every page

- Plain HTML and one shared CSS file. No scripts, no external requests, no fonts from the web, no tracking.
- `<title>` is the grave's title. `<meta name="description">` is the epitaph, so write it exactly as below.
- Each page has its **own favicon**: a simple flat SVG icon (`icon.svg` next to the page, linked with `<link rel="icon" href="icon.svg" type="image/svg+xml">`), one clear shape on a coloured rounded square. Every icon a different colour. Original drawings only: no logos, no emoji fonts.
- A believable page body: a heading, two to four short paragraphs or a small table, written plainly. Nothing that names a real company, product or person (except Edgar Allan Poe, whose story is in the public domain).
- English only. No exclamation marks.
- The fictional brand names below are invented; keep them.
- A footer on every page: "Demo page for Rest in Tabs. Not a real shop or service."

## Pages

| # | Path under `docs/demo/` | Title | Meta description (the epitaph) | Icon | Cause of death it shows |
|---|---|---|---|---|---|
| 1 | `recipes/sourdough-starter/` | Sourdough starter: a beginner's guide | How to feed, store and revive a sourdough starter, with a daily schedule. | loaf of bread | neglect |
| 2 | `travel/flights/` | Flights from Jakarta to Lisbon | Round trips from CGK to LIS in March, sorted by price. | plane | neglect (search "lisbon") |
| 3 | `travel/lisbon-weather/` | Lisbon weather | A 14-day forecast for Lisbon. | cloud with sun | neglect (second "lisbon" match) |
| 4 | `shop/cart/` | Shopping cart · Oak & Thread | One wool armchair and two picture frames, not yet paid for. | armchair | Abandoned at checkout. |
| 5 | `docs/q3-budget-memo/edit/` | Q3 budget memo | A budget memo with three headings and no paragraphs. | page with a folded corner | Abandoned mid-draft. |
| 6 | `wordwell/register/` | Create your profile · Wordwell | Learn a language in ten minutes a day. Pick a course to start. | speech bubble | Abandoned during sign-up. |
| 7 | `forum/regex-matches-nothing/` | Regex matches nothing | Asked four years ago. Three answers, none accepted. | question mark | Died a duplicate (open it in 3 tabs) |
| 8 | `books/house-of-usher/` | The Fall of the House of Usher | Full text of Edgar Allan Poe's short story, first published in 1839. | raven | neglect |
| 9 | `homes/two-bedroom-flat/` | Two-bedroom flat near the park | Two bedrooms, 74 m², balcony, available from April. | house | neglect |
| 10 | `wiki/lighthouses-of-portugal/` | Lighthouses of Portugal | A table of 48 lighthouses with the year each was built. | lighthouse | neglect |
| 11 | `design/landing-v7-final/` | Landing page v7 (final) | Version seven of seven. Two comments unresolved. | pen nib | neglect |
| 12 | `plants/yellow-leaves/` | Why are my leaves yellow? | Top answer: overwatering, low light or root rot, in that order. | leaf | neglect |
| 13 | `reviews/mechanical-keyboards/` | Best mechanical keyboards | Reviews of 40 keyboards, ranked by typing feel. | keyboard key | neglect |

Page 8 may carry the opening paragraphs of Poe's story (public domain), not the whole text.

## Index page

`docs/demo/index.html`, title "Rest in Tabs demo pages": one line on what the pages are for, then a list of links to all 13 pages (page 7 listed once, with the note "open it three times for a duplicate"). It is not itself meant to be buried, so it needs no icon of its own beyond a plain one.
