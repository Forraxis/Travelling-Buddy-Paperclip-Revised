# ROVER crawl → TravellingBuddy ingest (n8n)

**Status: authored, not executed.** This workflow + these notes are the *acquisition*
half of the ROVER pipeline (VEHICLE_DATA_FETCH.md decision 8): **n8n fetches, the app
parses + gates.** n8n never parses figures or makes trust decisions — it GETs ROVER
pages and POSTs raw HTML to the app's authenticated ingest endpoint, which does the
extraction (`extractRoverDocuments` → `parseRvdText` → `ingestRvd`) and lands
per-variant **PENDING** candidates. Nothing here auto-promotes.

> ⚠️ Runs against the live federal portal `rover.infrastructure.gov.au`. Keep it
> **polite** (weekly, single requests, AU egress). Do not raise the cadence or
> parallelise the per-approval GETs without a reason.

## What it does

`rover-crawl.json` mirrors the proven crawl mechanism (VEHICLE_DATA_FETCH.md
"ROVER portal crawl mechanism"):

1. **Weekly schedule** → **Prime session** `GET /PublishedApprovals/VTAApprovals/`
   (cookies: `ARRAffinity`, `Dynamics365PortalAnalytics`, `__RequestVerificationToken`).
2. **Get CSRF token** `GET /_layout/tokenhtml` → **Extract token** (regex).
3. **Fetch grid page** `POST /_services/entity-grid-data.json/c8825c88-ebd8-ee11-904d-000d3a7a0265`
   with the token header + `X-Requested-With`, body `{ base64SecureConfiguration,
   sortExpression: "rvr_publishedlastupdatedate DESC", page, pageSize }`.
4. **Filter** to towing-relevant categories (`M*/N*/MC/NA/NB1`, **excluding T trailers**)
   and only records **newer than the high-water mark** (stored in n8n workflow static
   data, per `rvr_publishedlastupdatedate`).
5. Per new/changed approval → **Fetch VTADetails** `GET /PublishedApprovals/VTADetails/?id=<rvr_approvalid>`
   (the page embeds every PDF inline as base64 — we do **not** parse it here).
6. **POST → app** `POST {APP_BASE_URL}/api/rover/ingest/` with `Authorization: Bearer
   {ROVER_INGEST_TOKEN}` and body `{ detailHtml }`. The app returns
   `{ ok, vtaNumber, variantsCreated, variantsRefreshed, amendment }`.
7. **Commit high-water mark + crawl-health**: advance the mark; if a run finds **0 new**
   when it usually finds some, raise a `crawlHealthAlert` (a 0-new run looks identical to
   "no new approvals" — the scraper may be broken). **Alert** node's TRUE branch is left
   unwired — connect it to Tim's email/Slack/webhook.

## One-time setup

1. **Import** `rover-crawl.json` into n8n (*Workflows → Import from File*).
2. **Set environment variables** on the n8n host (Settings → Variables, or process env):
   - `APP_BASE_URL` — the TravellingBuddy base URL, no trailing slash
     (e.g. `https://travellingbuddy.com.au`). The node appends `/api/rover/ingest/`
     (note the **trailing slash** — the app is `trailingSlash: true`, so omitting it
     costs a 308 hop).
   - `ROVER_INGEST_TOKEN` — **must match** the app's `ROVER_INGEST_TOKEN` env var. While
     the app's var is unset the endpoint returns **404** (invisible); set the same long
     random secret on both sides to bring it online.
   - `ROVER_GRID_SECURE_CONFIG` — the **captured `base64SecureConfiguration`** (below).
3. **Capture `base64SecureConfiguration`** (one-off, it's reusable from a fresh session):
   - Open `https://rover.infrastructure.gov.au/PublishedApprovals/VTAApprovals/` in a
     browser with devtools → Network.
   - Find the `entity-grid-data.json/...` XHR; copy the `base64SecureConfiguration`
     string from its **request payload** (it's the per-list grid config embedded in the
     page, not a secret/credential — but treat it as config and keep it out of git).
   - Paste it into `ROVER_GRID_SECURE_CONFIG`. If the grid call starts returning 0
     records, re-capture it.
4. **Session / CSRF dance** — the three-step `GET directory → GET tokenhtml → POST grid`
   order matters: the directory GET seeds the cookies, `tokenhtml` yields the
   anti-forgery token, and the grid POST needs **both** (cookie + `__RequestVerificationToken`
   header). Enable the HTTP Request nodes' **cookie jar** so cookies carry across the
   three calls in one execution. No login is required (public portal).
5. **Wire the alert** — connect *Alert if crawler looks broken* (TRUE) to your
   notification node.
6. **Egress** — run n8n behind the AU host + AU-presenting VPN so the portal sees a
   stable, polite AU IP (VEHICLE_DATA_FETCH.md decision 8 access note).

## Cadence

- **Weekly** (the schedule trigger is set to Monday 03:00 `Australia/Brisbane`). New
  approvals are caught within a week of publication. Amendments/withdrawals are rarer —
  the app's figure-level amendment detection (`ingestRvd` → `amendment`) handles
  re-issues idempotently, so re-seeing an unchanged approval is cheap (archived for
  history, no candidate churn).

## Guardrails (carried from ROVER_OVERNIGHT_BUILD.md)

- **No auto-promote.** Ingest lands PENDING; promotion is a separate, gated admin action.
- **No figure parsing in n8n.** It only moves HTML. All extraction + trust lives in the app.
- **Polite, incremental, single-request.** High-water mark, weekly, AU egress.
- The grid `base64SecureConfiguration` and the bearer token are **secrets/config** — set
  them in n8n, never commit them. `rover-crawl.json` carries only `$env` placeholders.

## Paging (TODO when enabling)

The *Fetch grid page* node requests `page: 1, pageSize: 100`. For the first backfill or a
busy week, loop pages (increment `page`) until the records run older than the high-water
mark — add a Loop/SplitInBatches around steps 3–4, or rely on the weekly cadence keeping
each run's new-record count well under 100. The grid response's `MoreRecords` flag tells
you when to stop.
