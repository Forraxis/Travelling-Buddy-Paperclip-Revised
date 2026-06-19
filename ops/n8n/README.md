# ROVER crawl → TravellingBuddy ingest (n8n)

The *acquisition* half of the ROVER pipeline (VEHICLE_DATA_FETCH.md decision 8):
**n8n fetches, the app parses + gates.** n8n GETs ROVER pages and POSTs raw HTML to
the app's authenticated ingest endpoint, which does the extraction
(`extractRoverDocuments` → `parseRvdText` → `ingestRvd`) and lands per-variant
**PENDING** candidates. Nothing auto-promotes.

> **Validated against live data (2026-06).** The whole mechanism — session, CSRF,
> grid, self-primed secure config, `/Date()` parsing, category filter, VTADetails
> extraction — was proven end-to-end. The workflow is **imported but NOT activated**;
> turning it on is a deliberate decision (it crawls the live federal portal).

## Design (pure-HTTP, self-priming — no browser, no manual config)

`rover-crawl.json` is 7 nodes:

1. **Weekly schedule** (Mon 03:00 `Australia/Brisbane`).
2. **ROVER: discover new approvals** (Code) — primes the session and **self-extracts
   `Base64SecureConfiguration`** from the directory page's `data-view-layouts`
   (base64 JSON), gets the CSRF token, pages the grid `DESC` by last-updated until it
   reaches the high-water mark or the per-run cap, parses the Microsoft `/Date(ms)/`
   timestamps, and keeps only towing-relevant categories (`M*`/`N*`; T-series trailers,
   `L*`, `O*` excluded). Emits one item per new approval + a `__control` row.
3. **Route: control vs approvals** (IF) — splits the `__control` row (→ health) from
   the approval rows (→ process).
4. **Process approvals (throttled) → ingest** (Code) — sequential, **oldest-first**,
   with a **jittered 4–10s wait** between ROVER hits. For each approval: GET the public
   VTADetails page → POST its HTML to `{APP_BASE_URL}/api/rover/ingest/` with the bearer
   token → **advance the high-water mark only on a successful ingest**. A mid-run block
   therefore leaves a clean, contiguous watermark (next run resumes exactly there; the
   app's ingest is idempotent, so any re-touch is harmless).
5. **Crawl-health** (Code) → **Alert needed?** (IF) → **Alert** (NoOp) — raises an alert
   when a run finds 0 new while it normally finds some (a silent scraper break). Wire the
   Alert node to your email/Slack.

**No `ROVER_GRID_SECURE_CONFIG` to capture** — the workflow primes it every run, so it
can never go stale.

## Anti-bot / politeness (built in)

- **Jittered**, never metronomic: 2.5–7s between grid pages, 4–10s between detail fetches.
- **Strictly sequential** (no parallel fan-out), browser-like `User-Agent` + `Accept-*`.
- **Per-run cap** (`MAX_NEW = 25` in the discover node) — natural throttle; raise/lower it.
- **Circuit-breaker**: any `403`/`429`/`503` (or a missing-layout parse failure) **throws
  and aborts the run** — it never pushes through a block. (Set an n8n *Error Workflow* to
  get notified on abort.)
- **AU egress confirmed**: n8n exits via `103.214.20.100` (Adelaide, AU) — a separate path
  from the rest of the network (the VPN). An AU gov portal seeing an AU IP is unremarkable.

## One-time setup

1. **Already imported** into n8n as *“ROVER crawl → TravellingBuddy ingest”* (inactive).
   To re-import after editing `rover-crawl.json`, replace via the n8n API / UI.
2. **App side:** make sure the app's `ROVER_INGEST_TOKEN` is set (it is, in `.env.local`)
   and the app is running on the new DB. Until the token is set the endpoint is a 404.
3. **n8n side — host env vars** (Variables are license-gated on this instance, so use
   process env):
   - `ROVER_INGEST_TOKEN` — **must equal** the app's value. *(The currently-imported copy
     has the token injected directly into the Process node, so it runs as-is; set the env
     var if you re-import the repo copy, which ships a `$env` placeholder for git safety.)*
   - `APP_BASE_URL` *(optional)* — defaults to `https://tbr.dev.ragebots.me`; set it to
     override.
4. **Wire the Alert** node (TRUE branch) to a notification, and optionally set an n8n Error
   Workflow so a circuit-breaker abort pages you.
5. **Smoke-test** before activating: open the workflow → *Execute Workflow* once. With the
   high-water mark unset (first run) it pulls up to `MAX_NEW` of the most-recently-updated
   towing-relevant approvals and ingests them; check the app's Admin → Spec Fetch for new
   PENDING candidates. Then **activate** for the weekly cadence.

## Backfill (separate, one-time)

This workflow is the **incremental / stay-current** job (forward from the high-water mark).
The existing ~5000-approval back-catalogue is **not** pulled by it. A historical backfill is
a separate run — sort the grid `rvr_approvalnumber ASC` and page through with a cursor,
spread across several nights (same throttle/circuit-breaker), letting the per-run cap pace
it. Ask before building it; it's the one bulk event that needs the most politeness.

## Notes

- The grid response is large (~240 KB/record). Weekly increments are tiny; only a bulk
  backfill makes the volume matter.
- Category filter is broad (`M*`/`N*`). To target only the off-road/ute/heavy tow rigs,
  tighten `KEEP` in the discover node to `^(MC|NA|NB1)$`.
- VTADetails is **public** (no cookies needed); only the grid POST needs the session.
