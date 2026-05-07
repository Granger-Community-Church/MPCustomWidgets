# GrangerEvents

Registration-events grid for the Granger Church website. Renders a card per upcoming event with a date badge, image, title, campus, and short description; clicking a card opens a portal-mounted modal with the full description and a registration link.

Backed by `api_Custom_GetRegistrationEvents` (in `StoredProc/`), filtered to non-cancelled, approved, future-dated events that match the visibility/event-type allowlist baked into the SP.

## Features

- **Card grid + modal detail view.** Modals are portalled to `<body>` on open so they escape any host-page header z-index trap.
- **Date sort.** Cards are sorted ascending by `Event_Start_Date` regardless of the order MP returns them in.
- **Series capping.** `data-max-series-events="N"` keeps only the first N events per series (by `Sequence_Order`); useful for long recurring series like Day Camp weeks.
- **Domain-local datetimes.** MP API datetimes carry a misleading `Z` suffix but represent local time; the widget parses them as such and formats with Granger's preferred style ("5 p.m.", "9:30 a.m.").
- **Cross-month and same-day date badges.** A single date badge automatically chooses between single-day, in-month range, and cross-month range layouts.

## Search

Powered by [Fuse.js](https://www.fusejs.io/) (loaded automatically from jsDelivr at widget init). Handles:

- **Typo tolerance** — `baptizm` finds baptism events.
- **Prefix matching** — `bapt` finds `baptism`, `baptize`, etc.
- **Synonym expansion** — `kids` ↔ `children`, `men` ↔ `man`, `women` ↔ `woman`, `youth`/`teens` ↔ `teen`. Configured in `GE_SYNONYMS` near the top of `GrangerEvents.js`.
- **Stop words** — `campus`, `campuses` are excluded from both the index and queries so prefix searches like `camp` don't match every event held at a Granger Campus location. Configured in `GE_STOP_WORDS`.
- **Multi-token AND** — `men breakfast` requires both terms to match.

Search runs on top of whatever the SP returned and operates against the event fields `Event_Title`, `Description`, `Additional_Description`, `Location_Name`, and `Program_Name`. Date sort is preserved (no relevance reordering).

To extend the synonym map or stop word list, edit the constants at the top of `GrangerEvents.js`. The side-by-side comparison harness at `compare-search.html` can be used to re-evaluate against alternative libraries against real data.

## Notable widget attributes

- `data-host="grangerchurch"` — required.
- `data-sp="api_Custom_GetRegistrationEvents"` — required.
- `data-template="/Widgets/GrangerEvents/Template/GrangerEvents.html"` — required.
- `data-params="@CongregationID=1"` etc. — pass any of the SP's optional filters: `@CongregationID`, `@ProgramID`, `@MinistryID`, `@Featured`. Combine with `&`.
- `data-max-series-events="2"` — cap each event series at N occurrences (default: no cap).
- `?s=foo` (URL query string) — adds `@Keyword=foo` to the SP params for server-side keyword filtering. Independent of the in-page Fuse search; the SP narrows the dataset and Fuse runs on top of whatever the SP returned.

## Files

- `GrangerEvents.js` — widget logic (search, modals, date formatting, ?s= → @Keyword wiring).
- `Template/GrangerEvents.html` — Liquid template rendered into the widget container.
- `StoredProc/api_Custom_GetRegistrationEvents.sql` — informational copy of the SP; deploying to MP is manual.
- `demo.html` — local-paths demo, mounts five widget instances exercising different filter combinations.
- `compare-search.html` — side-by-side search-library survey harness (MiniSearch vs. Fuse vs. baseline regex). Kept as a reference for future re-evaluation.
- `Schema/`, `Assets/` — supporting files.
