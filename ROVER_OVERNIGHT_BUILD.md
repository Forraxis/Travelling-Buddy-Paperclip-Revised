# ROVER ingestion — overnight build handover & plan

> **For a fresh context.** Read this top-to-bottom, then `VEHICLE_DATA_FETCH.md` (the living design
> log — the "Document-boundary findings + resolved scope" section has the 9 decisions + the proven
> crawl mechanism). Then execute the **Build plan** below, phase by phase, keeping the health gate
> green. **Honour the Guardrails.** Commit at the end; do not merge or push unless asked.

---

> ## ✅ OVERNIGHT BUILD COMPLETE (2026-06-18) — all 6 phases shipped
>
> Built on `feature/vehicle-data-fetch`. Health gate green: type-check clean · **518 tests** ·
> lint + prettier clean.
>
> - **Phase 1 — ingest endpoint.** `rover/extract-detail.ts` (`extractRoverDocuments` — regex the
>   inline base64 PDFs out of VTADetails HTML, dedupe desktop+mobile, classify, decode) +
>   `POST /api/rover/ingest` (bearer-gated: **404 when `ROVER_INGEST_TOKEN` unset**, 401 on
>   mismatch; multi-RVD → archive older, ingest latest). Env var added to `env.ts` + `.env.example`.
>   Tests: `rover-extract-detail.test.ts`, `route.test.ts` (DB mocked).
> - **Phase 2 — promotion.** Extracted the shared `promoteSpecCandidate()` core to
>   `spec-fetch/promote-candidate.ts` (gate + transaction + ModerationAction + AuditLog),
>   **idempotent re-promote** (refreshes the same variant via `resultingVariantId`). The admin
>   action now delegates to it. Runner `src/jobs/rover-promote-local.ts` **proved end-to-end on the
>   dev DB** (TRAKKA TORINO LWB → CATALOGUE, re-promote = same id, no duplicate). Tests:
>   `promote-candidate.test.ts` (gate block never opens a transaction).
> - **Phase 3 — amendment detection.** `rover/amendment.ts` (`diffRvdFigures` — compare mapped
>   figures by variant name; a pure re-label = NO_FIGURE_CHANGE). Wired into `ingestRvd` (loads the
>   latest prior archived version; NO_FIGURE_CHANGE → archive only, no candidate churn;
>   FIGURE_CHANGED → refresh + return the diff). Result surfaced in the endpoint response. Tests vs
>   the real corpus pairs: **Patrol 044896 → NO_FIGURE_CHANGE, Navara 047155 → NO_FIGURE_CHANGE,
>   RAM 047365 → FIGURE_CHANGED** (tare→kerb); confirmed on the dev DB too.
> - **Phase 4 — retire synthetic scaffolding.** `createRoverCrawlWorker` **unregistered** from
>   `workers/index.ts`; `@deprecated` headers on `parser/verifier/fixtures/crawl/field-map/ingest.ts`,
>   `rover-crawl.worker.ts`, and `roverCrawlQueue`. Not deleted; `verifier.ts` keeps
>   `draftGateableFields` (still used by `rover-variant-fields.test.ts`).
> - **Phase 5 — n8n workflow (authored, not run).** `ops/n8n/rover-crawl.json` (10 nodes: schedule →
>   prime session → token → grid POST → filter → VTADetails → POST ingest → high-water + crawl-health)
>   + `ops/n8n/README.md` (setup, the captured `base64SecureConfiguration`, the session/CSRF dance,
>   weekly cadence, guardrails).
> - **Phase 6 — docs** (this banner + the VEHICLE_DATA_FETCH.md resume block).
>
> **Not pushed/merged — left for Tim to review.** Still open (deliberately, per guardrails):
> Claude/AI gap-fill for GCM/axle (gated, Rule 11), VTA↔model-year mapping, the public confirmed-spec
> vehicle page + SEO, and actually *running* the n8n crawl (build it on the n8n server, set secrets).

---

## 1. Where we are (commit `8d6b0e2`, branch `feature/vehicle-data-fetch`)

The ROVER **vehicle** ingestion pipeline is built and proven with **real documents**. Health gate:
`npm run type-check` clean · `npm run test` **500 tests** · `npm run lint` (eslint + prettier) clean.

**Built + committed:**
- **Pure-Node parsers** (`unpdf`, no system deps): `src/lib/spec-fetch/rover/`
  - `pdf.ts` — `extractPdfText(Uint8Array)` (unpdf wrapper).
  - `rvd-parser.ts` — `parseRvdText` → `RvdDocument` { make, model, vtaNumber, categoryBroad,
    generatedDate, **per-variant** GVM/tare/braked+non-braked tow/GCM/dims/body/seating/axle-code,
    Remarks axle limits, `contentHash`, `rawText` }. Splits on "Variant information for …".
  - `approval-notice-parser.ts` — `parseApprovalNoticeText` → fine category (NA), approval/variation/
    expiry dates, holder, variant list.
  - Pinned to the **real 11-file corpus** in `docs/RVD/` (committed) by `rvd-parser.test.ts`.
- **Archive + ingest:**
  - `RoverDocument` table (migration `…_rover_document_archive`) — full raw text + structured parse,
    idempotent/versioned by `contentHash`.
  - `archive.ts` (`storeRvdDocument` / `storeApprovalNotice`, idempotent upsert), `variant-fields.ts`
    (RvdVariant → auto-corroborated candidate fields: GVM, tare→kerb, tow, wheelbase, length),
    `ingest-rvd.ts` (`ingestRvd(rvd, notice?)` → archive both + one `VehicleSpecCandidate` per
    (VTA, variant), provider=ROVER, criticals auto-corroborated, GCM/axle omitted → plate; dedupe by
    VTA+variant; lands **PENDING**).
  - `ROVER` value on `SpecFetchProvider` enum + `sourceVtaNumber`/`sourceReportUrl` on
    `VehicleSpecCandidate` (migration `…_rover_provenance`).
- **Local runners** (dev tools, not endpoints): `src/jobs/rover-parse-local.ts` (parse corpus →
  `docs/RVD/_parsed.json`), `src/jobs/rover-ingest-local.ts` (parse+ingest corpus → dev DB).
- **Gated synthetic crawl scaffolding** (from the first session, now superseded): `parser.ts`
  (Synthetic/PdfRoverParser), `verifier.ts`, `fixtures.ts`, `crawl.ts`, `field-map.ts`, `ingest.ts`
  (old single-variant `createRoverCandidate`), `rover-crawl.worker.ts` + `roverCrawlQueue` (gated
  behind `ROVER_CRAWL_ENABLED`). Tests: `rover.test.ts`, `rover-crawl-gate.test.ts`.

**Proven (not just built):**
- All 11 corpus RVDs + the Approval Notice parse correctly (per-variant figures, dates, hash).
- `rover-ingest-local.ts` produced **11 `RoverDocument` rows + 67 PENDING per-variant ROVER
  candidates** in the dev DB; auto-corroborated criticals clear `evaluatePromotionGate` with **no
  override**; re-run is fully idempotent (refresh-in-place).
- **The whole ROVER portal crawl is reverse-engineered + proven end-to-end from this machine**
  (no login — session + anti-forgery token). See VEHICLE_DATA_FETCH.md "ROVER portal crawl mechanism"
  for the exact requests. Headline: the VTADetails page (`/PublishedApprovals/VTADetails/?id=<guid>`)
  embeds **every document inline as base64** in `downloadPdfFile('<base64>','<name>.pdf>')` — so
  "download" = regex it out of the HTML and `Buffer.from(b64,'base64')`. No separate download URL,
  no R2 needed to fetch.

**Decisions (full text in VEHICLE_DATA_FETCH.md §"Resolved decisions"):** per-variant candidates;
raw-archive-now/structure-on-demand; AI gap-fill for GCM/axle = confidence-rated warning, never
green, plate is the real path; plate-consensus publish threshold **N=3** (provisional, Rule-11);
public vehicle page = confirmed data only (SEO); n8n owns acquisition; **caravans PARKED** (ROVER
has no usable caravan spec data — do not build them).

---

## 2. Build plan (execute in order; gate green after each phase)

### Phase 1 — Inline-document extraction + app ingest endpoint  *(the n8n target)*
- **`src/lib/spec-fetch/rover/extract-detail.ts`** (pure): `extractRoverDocuments(html: string)` →
  `{ filename, docType: 'RVD'|'APPROVAL_NOTICE'|'OTHER', bytes: Uint8Array }[]`. Regex
  `/downloadPdfFile\('([A-Za-z0-9+/=]+)',\s*'([^']+\.pdf)'\)/g`, **dedupe by filename** (each doc has
  a desktop + mobile button), classify by filename ("Road Vehicle Descriptor"→RVD, "Approval
  Notice"→APPROVAL_NOTICE, else OTHER), base64-decode. Unit-test with a synthetic HTML fixture.
- **`src/app/api/rover/ingest/route.ts`** (Next App-Router `POST`): **bearer-token gated** via env
  `ROVER_INGEST_TOKEN` — **if the env var is unset, return 404** (stay invisible); if set and the
  `Authorization: Bearer …` mismatches, 401. Body `{ detailHtml: string }` (n8n posts the VTADetails
  HTML). Pipeline: `extractRoverDocuments` → for the RVD: `extractPdfText` → `parseRvdText`; for the
  Approval Notice: `parseApprovalNoticeText` → `ingestRvd(rvd, notice)`. Return
  `{ ok, vtaNumber, variantsCreated, variantsRefreshed, archivedRvdId, archivedNoticeId }`.
- Add `ROVER_INGEST_TOKEN: optionalString` to `src/lib/env.ts` (mirror `SPEC_FETCH_LIVE_ENABLED`).
- **Tests:** extract-detail (synthetic fixture, dedupe + classify + decode); route auth gating
  (404 when unset, 401 on mismatch) — mock `@/lib/db` so the route test needs no DB.
- **Acceptance:** endpoint inert without token; type-check/test/lint green.

### Phase 2 — Promotion path (candidate → CATALOGUE `VehicleVariant`)
- The existing admin spec-fetch flow already has a **promote** action
  (`src/app/admin/catalogue/vehicles/spec-fetch/actions.ts`, uses `evaluatePromotionGate` +
  `buildVariantPatch` + ModerationAction + AuditLog). **Read it first and REUSE it** — ROVER
  candidates are ordinary `VehicleSpecCandidate` rows, so the existing promote should work.
- Extract a reusable, DB-touching `promoteRoverCandidate(candidateId)` (or verify the existing action
  works programmatically), make it **idempotent** (re-promote updates the same variant via
  `resultingVariantId`), resolve free-text make/model to catalogue rows, create/update a
  **CATALOGUE** `VehicleVariant`, set candidate `status=APPROVED` + `resultingVariantId`.
- A local runner `src/jobs/rover-promote-local.ts` that promotes one corpus candidate to prove it
  end-to-end against the dev DB; then verify the variant doesn't leak publicly until CATALOGUE.
- **Do NOT auto-promote on ingest** (gate level is Tim's Rule-11 call — ingest stays PENDING).
- **Acceptance:** a corpus ROVER candidate promotes to a CATALOGUE variant with the mapped fields;
  re-promote idempotent; gate enforced.

### Phase 3 — Figure-level amendment change detection
- **`src/lib/spec-fetch/rover/amendment.ts`** (pure): `diffRvdFigures(prev: RvdDocument, next:
  RvdDocument)` → `{ status: 'NO_FIGURE_CHANGE'|'FIGURE_CHANGED', changes: {variant, field, from,
  to}[] }`. Compare per-variant mapped figures (GVM/tare/tow/GCM/dims) by variant name.
- Wire into `ingestRvd`: before writing, load the **latest** archived `RoverDocument` for that VTA;
  if `contentHash` differs but figures are identical → `NO_FIGURE_CHANGE` (admin re-issue — archive
  the new version for history but don't churn candidates / don't flag for re-review); if figures
  changed → `FIGURE_CHANGED` (refresh candidates + surface the diff in the result for review).
- **Tests** with the 3 corpus amendment pairs: **044896 Patrol** (variant *names* changed, figures
  same → NO_FIGURE_CHANGE on the mapped figures), **047155 Navara** (identical → NO_FIGURE_CHANGE),
  **047365 RAM** (tare changed → FIGURE_CHANGED).
- **Acceptance:** the three pairs classify correctly; ingest returns the diff.

### Phase 4 — Retire synthetic scaffolding *(deprecate, don't hard-delete)*
- The synthetic path (`parser.ts`, `verifier.ts`, `fixtures.ts`, `crawl.ts`, `field-map.ts`, old
  `ingest.ts`, `rover-crawl.worker.ts`, `roverCrawlQueue`) is superseded by the real parser +
  endpoint. **Unregister** `createRoverCrawlWorker()` from `src/lib/workers/index.ts` and add a
  `@deprecated` header to those files pointing to the real path. **Do not delete yet** — a later
  focused cleanup removes them once the endpoint is live.
- ⚠️ **Cross-import:** `rover-variant-fields.test.ts` imports `draftGateableFields` from `verifier.ts`.
  If you touch `verifier.ts`, keep that export OR update the test to build `GateableField[]` inline.
- **Acceptance:** no dead **registered** worker; tests green.

### Phase 5 — n8n workflow JSON *(authored only — cannot be run without the n8n server/creds)*
- **`ops/n8n/rover-crawl.json`** — the workflow, mirroring the proven mechanism: Schedule trigger →
  GET directory page (cookies) → GET `/_layout/tokenhtml` (token) → POST
  `…/entity-grid-data.json/c8825c88-ebd8-ee11-904d-000d3a7a0265` (body: `base64SecureConfiguration`
  **(placeholder — Tim pastes a captured value)**, `sortExpression: "rvr_publishedlastupdatedate
  DESC"`, paging) → filter category to towing-relevant (M/N/MC/NA/NB1, **exclude T trailers**) +
  newer than the high-water mark → per approval: GET `VTADetails?id=<rvr_approvalid>` → extract the
  `downloadPdfFile('<b64>','<name>')` calls → POST `{ detailHtml }` to the app `/api/rover/ingest`
  with the bearer token. Crawl-health: alert if a run finds 0 new when it normally finds some.
- **`ops/n8n/README.md`** — import steps; set `N8N` creds + the captured `base64SecureConfiguration`
  + the app `ROVER_INGEST_TOKEN`; the 3-step session/CSRF dance; cron cadence (weekly).

### Phase 6 — Docs
- Update VEHICLE_DATA_FETCH.md "Resulting build order" / "Still open" to mark what got built; refresh
  the resume block. Keep this handover doc's "Where we are" accurate.

---

## 3. Guardrails (do NOT cross these)

- **NO live ROVER crawl against `rover.infrastructure.gov.au`.** The mechanism is proven; do not run
  automated crawls unattended. Build + test against the **local `docs/RVD/` corpus + dev DB** only.
  The endpoint is tested with a fixture; the n8n workflow is **authored, not executed**.
- **NO auto-promote.** Ingest lands candidates PENDING. Promotion is an explicit action (gate level
  is Tim's Rule-11 call).
- **NO un-gating axle/GCM, NO AI/Claude gap-fill** (needs `ANTHROPIC_API_KEY` + Rule-11 sign-off).
- **NO caravans** (parked — ROVER has no usable caravan data).
- **NO touching** kerb-CoG / SSF stability gating or any physics sign-off (Rule 11 = Tim's call).
- **VTA↔model-year** stays the placeholder (approval-window year). Don't invent model years.
- Keep secrets out of git (`.env.local`, the n8n secureConfig/token are placeholders in committed
  files).

## 4. Gotchas (from CLAUDE.md + this build)

- **Prisma 7:** CLI needs `DATABASE_URL` inline:
  `DATABASE_URL=postgresql://travelbuddy:travelbuddy_dev@localhost:5432/travellingbuddy npx prisma migrate dev --name …`.
  **After any schema change, regenerate the client** (`… npx prisma generate`) or type-check fails on
  the stale client. Docker `tb-postgres` (5432) + `tb-redis` (6379) must be up.
- **Lint gate includes prettier** — run `npm run lint:fix` to auto-format before the final gate.
- `trailingSlash: true` — API routes end in `/`; fetch follows a 308.
- Standalone `src/jobs/*` scripts run via `npx tsx`; `@/lib/db` already builds the PrismaPg adapter.
- Trailer/caravan RVDs use a **different layout** (no "Variant information for" blocks) — irrelevant
  now (caravans parked, vehicle corpus is all M/N), but don't assume the parser handles every layout.

## 5. How to kick off (fresh context)

1. `git status` (expect clean working tree on `feature/vehicle-data-fetch` at `8d6b0e2` — note: this
   handover + the caravan finding may be an extra uncommitted change; commit them first if so).
2. Confirm the gate is green: `npm run type-check && npm run test && npm run lint`.
3. Execute Phases 1→6 in order. Run the gate after each phase; fix before moving on.
4. Use the local corpus (`docs/RVD/`) + dev DB for all verification. Never crawl the live portal.
5. At the end: `npm run lint:fix`, confirm gate green, **commit** with a clear message
   (`feat(spec-fetch): ROVER ingest endpoint + promotion + amendment detection + n8n workflow`).
   **Do not merge or push** unless asked — leave it for Tim to review.
6. Update this doc's "Where we are" + the VEHICLE_DATA_FETCH.md resume block to reflect the new state.
