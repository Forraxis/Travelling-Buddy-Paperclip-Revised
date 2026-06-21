# Vehicle Catalogue Build — Handover (2026-06-20)

How the live vehicle catalogue got built this session, the exact state it's in, what's
running, and what's left. Companion to `VEHICLE_DATA_SOURCES.md` (the source/trust
strategy) — read that for the *why*; this is the *what happened + what next*.

> **TL;DR** — The catalogue is now populated from **QLD rego** (GVM/kerb) + **ROVER/RAV**
> (GCM/tow + GVM-upgrade overlays + trucks), all `ESTIMATE`-pending-plate. **115 makes /
> 1,070 models / 5,121 variants / 173 GVM-upgrade overlays.** Upgrade kits correctly sit
> as overlays, never as makes. **Two known gaps:** (1) ~928 heavy-commercial junk variants
> (>8t cranes/prime-movers) need deleting; (2) **axle limits are 0** — neither QLD nor
> ROVER carry them; they need AI-grounding or owner's-manual VLM. All pipelines are
> **idle/complete** right now.

---

## ▶ Resume prompt (paste into a new session)

> Continue the TravellingBuddy vehicle-catalogue work in
> `Travelling-Buddy-Paperclip-Revised/` on branch `feature/vehicle-data-fetch`.
> **First read `CATALOGUE_BUILD_HANDOVER.md`** (full state) and `VEHICLE_DATA_SOURCES.md`.
> Key facts: the live DB is the **remote** one in `.env.local`
> (`172.16.45.240/travelling_buddy_revised`) — NOT the local docker `tb-postgres`; query via
> `docker exec tb-postgres psql "$DB" …`. Catalogue is built from QLD (GVM/kerb) + ROVER
> (GCM/tow + 173 GVM-upgrade overlays): 115 makes / 1,070 models / 5,121 variants, all
> ESTIMATE-pending-plate. All pipelines are idle/complete. Nothing is committed.
> Constraints: never hit ROVER from this box (n8n/AU-VPN only); compliance fields stay
> Rule-11 gated (Tim signs off); commit only when asked.
> **Do, in priority order:** (1) **task #12** — merge QLD↔ROVER duplicate nameplate models
> (HiLux + Hilux 8GEN/AN2/SSM, Ranger + RANGER 3/3R/…, etc.; consolidate to one model per
> nameplate, re-point overlays, delete dupes — the biggest issue, breaks clean search);
> (2) **task #10** — delete ~928 heavy junk variants (>8t cranes/prime-movers) + tighten the
> ROVER discovery filter; (3) **task #6/#11** — axle limits (still 0) via AI grounding or
> owner's-manual VLM (needs an `ANTHROPIC_API_KEY`, or local Ollama on `172.16.45.150`
> restarted — currently down). Confirm before any spend / live-portal run.

---

## 0. CRITICAL: which database

The app + all jobs use the **REMOTE** Postgres in `.env.local`:
`postgresql://…@172.16.45.240:5432/travelling_buddy_revised`. The local docker
`tb-postgres` → `travellingbuddy` is a **stale `.env.example` leftover** (behind schema,
empty of this data) — querying it will make it look like data is missing. Always use the
`.env.local` URL. No local `psql`; tunnel through the container as a client:

```bash
DB="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')"
docker exec tb-postgres psql "$DB" -tAc 'select count(*) from "VehicleVariant";'
```

---

## 1. Current catalogue state (real numbers, 2026-06-20)

| Table | Count |
|---|---|
| VehicleMake | 115 |
| VehicleModel | 1,070 |
| VehicleVariant | 5,121 |
| └ ≤8t (cars/utes/vans/light-trucks — KEEP) | 4,193 |
| └ >8t (cranes/prime-movers — **JUNK, delete**) | 928 |
| GvmUpgrade overlays | 173 |
| Variants with GVM / GCM / kerb / **axle** | 5,121 / 1,169 / 5,077 / **0** |

> GCM is only on the **ROVER-sourced** variants (~1,169); QLD-only car variants have GVM/kerb but no
> GCM (QLD doesn't carry it). ~1,769 candidate GCM values exist but ~600 didn't land — they belong to
> second-stage/non-base approvals that aren't promoted as base variants (expected), or were gate-held.

- **QLD fleet:** 43,484 combos ingested; 19,208 `AUTO`. Source of GVM + kerb (mode of registrations).
- **ROVER/RAV:** index = 1,321 approvals, **all EXPANDED**; 6,467 RVD PDFs parsed; 8,601 spec candidates. Source of GCM/tow + the GVM-upgrade overlays + trucks.

---

## 2. How the data flows (the pipeline)

```
QLD rego CSV ──► QldFleetVehicle ──(qld-promote)──►  VehicleMake/Model/Variant  (GVM,kerb = ESTIMATE/QLD_REGO)
                                                          ▲
ROVER grid  ──► RoverApprovalIndex ──(expand: n8n→VPN→app ingest, parse RVD PDFs)──► VehicleSpecCandidate
                       │                                   │
                  normalize+classify                  (promote-base)──► base variants (GCM/tow = ESTIMATE/ROVER)
                       │                                   │
                       └── secondStageType=GVM_UPGRADE ─(promote-gvm-upgrade)──► GvmUpgrade overlay on base
```

**The safeguard (why "Ironman" is an overlay, not a make):** `rover-normalize-local.ts`
resolves `"IRONMAN TOYOTA HILUX"` → base **Toyota Hilux** + modifier **Ironman**,
`isSecondStage=true`; `rover-classify-second-stage-local.ts` tags it `GVM_UPGRADE`;
promotion then routes it to a `GvmUpgrade` **overlay**, and `promote-base` only ever takes
`isSecondStage=false`. **Always run normalize + classify before any promote.** (The old
stale "Ironman TMCA Toyota" make existed because a promote ran *before* classify was wired —
since deleted.)

---

## 3. Decisions baked in (from Tim)

- **Tow-relevant bodies only** (Dual Cab / Ute / Cab-Chassis / Wagon+SUV / Van); sedans/hatches/hearses excluded.
- **One model per nameplate** (HiLux once); body + spec live on the variant name.
- **Spec-generation variant split** — contiguous years sharing factory GVM collapse into one `yearFrom–yearTo` variant.
- **Scope:** 2005 year floor; iconic long-life rigs (HiLux/LandCruiser/Patrol/Pajero/Navara/Prado) back to 1990; per-variant ≥25 regs; sanity guards drop impossible kerb/GVM.
- **Class-aware body rule** — keeps genuine factory cab-chassis/crew-cab on van nameplates (e.g. Sprinter) while dropping tray/wagon conversions.
- **Light trucks** — curated Isuzu N-series / Fuso Canter / Hino 300+Dutro / Iveco Daily (QLD gives only the ≤4.5t grades; heavy 4×4 tow-trucks come via ROVER).
- **Everything `ESTIMATE`-pending-plate**; plate stays the only path to VERIFIED (Rule 11).

---

## 4. New files this session

**Jobs (`src/jobs/`):**
- `qld-promote-local.ts` — QLD `AUTO` → catalogue. `--dry-run`(default)/`--write`/`--make=`/`--min-regs=`/`--min-band-regs=`/`--min-body-regs=`. Idempotent + reconciles orphans.
- `rover-expand-bulk-local.ts` — drives the n8n expand webhook per UNFETCHED row. Jitter + escalating backoff (honours `Retry-After`) + 120s timeout + abort-on-persistent-block. Resumable. `--min/--max/--cap/--timeout`.
- `rover-promote-gvm-upgrade-bulk-local.ts` — bulk-attaches EXPANDED `GVM_UPGRADE` candidates as overlays (no base fabrication).
- `rover-backfill-discover-local.ts` — drives the backfill webhook (full ASC grid sweep), upserts skeleton rows. `--start-page=` resumes.

**Ops:**
- `ops/n8n/rover-backfill.json` — n8n workflow (webhook `rover-backfill`), **imported + active in n8n**. ASC full-sweep grid discovery, discovery-only.
- `ops/rover-pipeline.sh` — the self-driving chain: wait-for-expand → normalize+classify → promote → backfill → normalize+classify → expand → promote. Reads secrets from `.env.local`.

**Schema (migrations applied to the remote DB):**
- `20260620061913_add_qld_rego_provenance_source` — `QLD_REGO` value on `SpecProvenanceSource`.
- `20260620063140_add_max_roof_load` — `maxRoofLoadKg Int?` on `VehicleVariant` (unpopulated; for rooftop-tent load → GVM + vertical CoG).

**Reused existing jobs:** `rover-normalize-local.ts`, `rover-clean-base-model-local.ts`,
`rover-classify-second-stage-local.ts`, `rover-promote-base-local.ts`, `qld-fleet-ingest-local.ts`,
`qld-normalize-local.ts`.

> Runners: QLD jobs use `npx jiti`; ROVER jobs use `npx tsx`. All read `DATABASE_URL` from env.

> **Repo state: NOTHING is committed.** All of the above is **untracked/modified on branch
> `feature/vehicle-data-fetch`** (per the commit-only-when-asked convention). The two new
> migrations are applied to the remote DB but their migration folders are untracked too —
> commit them together so schema and history stay in sync. `secureconfig.local.txt` (ROVER
> grid secret) and `.rover-skeleton*.jsonl` must stay gitignored.

---

## 5. Infrastructure & gotchas

- **Egress rule:** NEVER hit ROVER/RAV from this box (home IP). All ROVER fetches go through
  **n8n** (`172.16.45.151:5678`), which egresses via the **AU VPN** (`103.214.20.100`). This
  box only ever calls n8n + the app + the DB.
- **n8n:** `N8N_BASE_URL`/`N8N_API_KEY` in `.env.local`. Workflows: `rover-expand` (active),
  `rover-crawl` (incremental, inactive — not used here), `rover-backfill` (active, new).
- **nginx 413 / internal app URL:** large ROVER detail pages (inline PDFs) exceed the public
  edge's `client_max_body_size` → 413. The expand therefore posts ingest to the app's
  **internal** URL `http://172.16.1.239:3070` (`APP_BASE_URL`), bypassing the edge. The ROVER
  hop is still the VPN — only the n8n→app return hop changed. **Long-term fix:** raise the edge
  nginx `client_max_body_size` (then the scheduled crawl can use the public URL too).
- **Local Qwen/Ollama is DOWN** (`172.16.45.150`): Open WebUI is up on `:8080` but reports
  "WebUI could not connect to Ollama"; the Ollama API (`:8081` / `:11434`) isn't serving.
  Needs a restart on that box before any local VLM pass.
- **AI spec-fetch is MOCK-only / gated:** `SPEC_FETCH_LIVE_ENABLED` unset, no `ANTHROPIC_API_KEY`,
  `VLM_ENDPOINT_URL` unset. `claude.ts` provider is a scaffold that throws (web-grounded path is a TODO).

---

## 6. What's done vs open

**Done & verified:**
- QLD promotion (cars/utes/vans/light-trucks) with GVM/kerb.
- ROVER expand (all 1,321) + promote → base variants + 173 GVM-upgrade overlays; GCM on 1,169.
- All ROVER RVD PDFs parsed (6,467 docs).
- Backfill swept the **entire** grid → confirmed we already hold the complete towing-relevant set (~1,321); the ~5–8k register total is mostly trailers/bikes/heavy we exclude.
- Zero upgrade-kit/coachbuilder makes (safeguard verified).
- `type-check` / `lint` / `prettier` clean; 599 tests pass.

**Open (prioritised):**
0. **⚠️ MODEL FRAGMENTATION — QLD↔ROVER not merged (biggest issue).** ROVER promoted using the
   RVD's platform/generation model strings, which slug differently from QLD's canonical nameplate, so
   the **same vehicle appears as several models**:
   `Toyota → HiLux (QLD) + Hilux 8GEN + Hilux 8GEN SSM + Hilux AN2 (ROVER)`;
   `Ranger → Ranger + RANGER 3 + RANGER 3 NB1 + RANGER 3R + RANGER 3SD + Ranger Raptor`;
   `Navara → Navara + D23 Navara + D27 Navara`; LandCruiser/D-Max/Triton/Patrol likewise. ~81 models
   carry an obvious gen/platform suffix; true count of duplicate nameplates is higher. This is the
   QLD↔ROVER **merge key** that `VEHICLE_DATA_SOURCES.md` flagged as "to settle" and that was **not
   implemented on the ROVER side**. **Breaks "one model per nameplate" + clean search.** Fix: a
   model-merge/dedup pass — map ROVER gen/platform model strings → canonical nameplate (extend
   `cleanBaseModel` to strip `8GEN/AN2/RG1/D23/LB-LC/J30T/"RANGER 3"`-style codes + reconcile to the QLD
   model slug), merge variants under the one model, **re-point the GvmUpgrade overlays** (they currently
   attach to the ROVER gen-named base, while GVM/kerb sit on the QLD nameplate), delete emptied dupes.
   No data lost — it's a consolidation. *(highest priority for search quality)*
1. **Heavy-truck junk cleanup** — delete the 928 variants `>8t GVM` (cranes/prime-movers) + their
   orphaned makes, and tighten the discovery KEEP filter to exclude NC. Sandbox-safe, no deps.
2. **Axle limits (the differentiator, currently 0)** — needs a data source:
   - **AI web-grounded (recommended):** set `ANTHROPIC_API_KEY` → implement `claude.ts` (`web_search` +
     structured outputs) → build a **hot-set batch job** (top ~26 by QLD prevalence) → flagged ESTIMATE +
     per-field citations. ~$5 for the hot set. Stays Rule-11 gated.
   - **Owner's-manual VLM:** collect manuals → run through Tesseract+Qwen (needs Ollama back up) → CONFIRMED.
   - **Or defer** — GVM/GCM/kerb + overlays is already a strong launch dataset; axle/CoG is the post-launch layer.
3. **Roof load** (`maxRoofLoadKg`, task) — same sourcing as axle; rooftop-tent load eats GVM + raises CoG (Rule 11).
4. **The hot-set batch job** — provider-agnostic, doesn't exist yet; build once a provider is chosen.

---

## 7. How to run / resume each piece

```bash
cd Travelling-Buddy-Paperclip-Revised
DB="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | tr -d '"')"

# QLD promote (re-run anytime; idempotent)
DATABASE_URL="$DB" npx jiti src/jobs/qld-promote-local.ts            # dry-run
DATABASE_URL="$DB" npx jiti src/jobs/qld-promote-local.ts --write

# Full ROVER chain (waits for any in-flight expand, then runs everything)
bash ops/rover-pipeline.sh            # logs to stdout; nohup it for background

# Individual ROVER steps (all need the env block below)
export DATABASE_URL="$DB"
export ROVER_EXPAND_WEBHOOK_URL="$(grep '^ROVER_EXPAND_WEBHOOK_URL=' .env.local | cut -d= -f2- | tr -d '"')"
export ROVER_INGEST_TOKEN="$(grep '^ROVER_INGEST_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')"
export N8N_BASE_URL="$(grep '^N8N_BASE_URL=' .env.local | cut -d= -f2- | tr -d '"')"
export APP_BASE_URL="http://172.16.1.239:3070"   # internal — bypasses nginx 413
npx tsx src/jobs/rover-backfill-discover-local.ts      # discover (full sweep)
npx tsx src/jobs/rover-normalize-local.ts             # normalize  ┐ ALWAYS before promote
npx tsx src/jobs/rover-clean-base-model-local.ts      # clean      │ (Ironman→overlay safeguard)
npx tsx src/jobs/rover-classify-second-stage-local.ts # classify   ┘
npx tsx src/jobs/rover-expand-bulk-local.ts --min=12 --max=25  # expand UNFETCHED
npx tsx src/jobs/rover-promote-base-local.ts                   # base → variants
npx tsx src/jobs/rover-promote-gvm-upgrade-bulk-local.ts       # GVM upgrades → overlays
```

Run artifacts/logs from this session live in `/tmp/rover-run/` (gitignored scratch).

---

## 8. Living docs

- `VEHICLE_DATA_SOURCES.md` — source map, trust tiers, promotion plan (updated this session).
- `VEHICLE_DATA_FETCH.md` — the on-demand AI spec-fetch design.
- `VEHICLE_DATA_HUB.md` — admin browse/coverage surface.
- `ops/n8n/README.md` — the ROVER crawl/expand n8n design + politeness rules.

---

# SESSION 2 — 2026-06-21 (model merge, RVD sweep, AXLE LIMITS solved)

Continued from §6 open items. **The headline: axle limits went from 0 → 215 variants.** Three
of the four §6 "open" items are now done. All new work is on `feature/vehicle-data-fetch`,
still uncommitted at start of this session (committed at its end).

## S2.1 Catalogue model-merge (was open item #0 — the biggest issue) — DONE
QLD↔ROVER nameplate fragmentation fixed. `src/jobs/catalogue-model-merge-local.ts` (dry-run
default / `--write`) folds ROVER gen/platform-named models ("Hilux 8GEN", "D23 Navara",
"RANGER 3") onto the QLD canonical nameplate **only when that clean nameplate already exists as
a sibling** (never guesses; Polestar-2-vs-3 type ambiguity is reported, not merged). Handles the
`(modelId,name,year-range)` exclusion constraint by spec-merging true duplicate variants
(coalesce specs + carry overlays + delete dup). **Applied: 1,070→1,004 models, 66 folded, 37
duplicate variants merged, 173 overlays preserved (0 orphaned).** Idempotent. Backup of the 3
tables was taken to `/tmp/catalogue-merge-backup/` before the write.

## S2.2 RVD spec sweep — DONE
`src/jobs/rvd-sweep-local.ts` parses all 6,467 stored `RoverDocument.rawText` (already extracted,
no fetch/egress) via `parseRvdText` → writes structured specs to `RoverDocument.parsed` (jsonb):
**33,176 variants** — GVM & wheelbase 100%, tare 93%, braked-tow 72%, length 70%, GCM 21%, plus
broad-pattern axle extraction giving **169 docs with front/rear axle**. Caveat: RVD axle data is
only stated for SECOND-STAGE/re-rated builds (motorhomes/ambulances/GVM-upgrades), NOT base
passenger rigs. Queryable archive; not promoted to catalogue (the base specs were already
promoted earlier, so there was nothing to add — verified 0 fillable gaps on linked variants).

## S2.3 Axle limits — the four-source journey, and the winner
The §6 differentiator. Tried four sources:
- **AI web grounding** — `src/lib/spec-fetch/providers/claude.ts` is now REAL (Opus 4.8 +
  server-side `web_search_20260209` + a strict custom record tool for structured output; the
  manual loop forces the record tool from turn 1 to avoid slow pause_turn stacking).
  `src/jobs/ground-axle-hotset-local.ts` ran it on 5 rigs (~$7). **Result: fills gcm / front+rear
  overhang / fuel / dimensions at HIGH confidence with citations, but axles mostly NULL** (only
  Mitsubishi-style OEMs that publish a spec PDF yield them; Toyota/Ford/Nissan don't). Lands
  `VariantSpecProvenance` source=CLAUDE/ESTIMATE.
- **Owner's-manual VLM pipeline** — built and proven, but manuals aren't sourceable:
  - `src/lib/spec-fetch/manual/extract.ts` — PDF → **pre-screen** (free text-layer gate: no
    weight-rating terms → `NO_WEIGHTS`, skip — rejects workshop/repair manuals) → locate weights
    pages → **text-first, VLM-fallback** → Qwen → **validate extracted GVM vs our known** →
    verdict (CONFIRMED/REVIEW/NO_AXLE/REJECT/NO_WEIGHTS). Proven on a real RVD (recovered axles
    2100/2400, CONFIRMED). Uses `@napi-rs/canvas` + `unpdf` for render.
  - **Local VLM stack on `.150` (back up):** `granite-docling-258M` on **:8085** (vision,
    `llama-server -hf ggml-org/granite-docling-258M-GGUF:Q8_0`, prompt "Convert this table to
    OTSL") → Qwen 35B on **:8082** with **`chat_template_kwargs:{enable_thinking:false}`** (drops
    it from ~4k reasoning tokens to ~73, ~1s; `/no_think` does NOT work on this build). Both
    OpenAI-compatible, free.
  - `ops/n8n/manual-fetch.json` (n8n workflow, active, id `7HsncDT7deMXpmq4`) downloads PDFs via
    VPN; `src/jobs/fetch-and-extract-local.ts` wires it to the core; `src/jobs/source-manuals-local.ts`
    + `src/jobs/discover-manuals-local.ts` are the Claude URL-discovery loop (verified, capped,
    cached, Rule-11-safe). **Result: 5/5 NO_URL (~$2) — owner's manuals are gated/portal'd/VIN'd,
    NOT openly downloadable.** Dead end for web discovery. The *extraction* works if Tim supplies a
    real owner's-manual PDF.
- **RVD second-stage** — the 169 from S2.2 (motorhomes/upgrades only).
- **GVM-upgrade certifiers (LOVELLS) — THE WINNER.** Lovells publishes FACTORY front/rear axle +
  GVM + GCM per popular tow rig (cited from the OEM to baseline their kit), as labelled HTML
  (`OEM FRONT AXLE`→value) — deterministic parse, no AI/VLM, free. (Pedders 403s bots.)
  - `src/jobs/lovells-harvest-local.ts` — crawls the ~37 `lovells.com.au/vehicle/...` pages
    (in-here; benign) → `ops/n8n/.lovells.jsonl`. Spot-checks exact (HiLux 1480/1700, Ranger
    1490/1959; factory GVM matches our catalogue).
  - `src/jobs/lovells-land-local.ts` — **gen-aware landing**: parses each generation's year range
    from the URL slug, matches catalogue variants by **year-overlap + GVM tiebreak**, skips
    ambiguous (never GVM-only — that mis-assigns generations). **LANDED axle on 215 variants
    (was 0)** — HiLux/LandCruiser/Prado/Ranger/Everest/D-Max/MU-X/BT-50/Patrol — as
    `VariantSpecProvenance` source=MANUAL/ESTIMATE, sourceUrl=Lovells page, **Rule-11-gated**.
    Verified gen-split correct (HiLux KUN 2005-15→1340/1600, GUN 2015+→1480/1700). 424 axle rows.

**Axle coverage after Lovells:** 215 variants (Toyota 105 · Isuzu 49 · Ford 39 · Nissan 14 · Mazda 9).

### S2.3b Brave-dork PDF discovery → axle for the gap vehicles + SUVs (the general source)
Tim's idea: search-engine "dorks" → bulk PDF pipeline. Built (Brave Web Search API, NOT Google
scraping — Google CAPTCHA-bans bots):
- `src/jobs/brave-pdf-search-local.ts` — per vehicle × dork template (gen-level, e.g.
  `{v} filetype:pdf gvm gcm specifications`) → Brave API → deduped PDF URL list (`.brave-pdfs.jsonl`).
  3 dork templates carry the load; "exact-phrase axle" dorks return ~0 (dropped).
- `src/jobs/brave-extract-local.ts` — fetch each PDF in-here, **content-hash dedup** (same spec sheet
  mirrored on dozens of sites), run the manual-extract pipeline (pre-screen → text/VLM → Qwen). Size
  cap + timeout + per-PDF progress file. 21 vehicles → 540 candidates → 379 unique → **77 with axle**.
- `src/jobs/brave-land-local.ts` — **GVM-keyed** gen-aware landing (these PDFs lack year ranges, but
  GVM discriminates the gen): match catalogue variants by GVM ±5%, prefer AU/OEM sources, require
  axle agreement (skip conflicts). Landed **84 variants** (gap utes Navara/Triton/Holden Colorado+Rodeo
  + SUVs X-Trail/CX-5/Kluger/Outlander/Pajero/Forester/Tucson/ASX/CR-V), MANUAL/ESTIMATE, Rule-11-gated.
- Domains: OEM (nissan/ford/mitsubishi/vw .com.au), dealer CDNs, spec archives. Cross-source corroboration
  (Triton 1260/1840 from 3 sites; matches the grounding finding). Caveat: some lands from foreign/odd
  sites (subaruport.ru etc.) — ESTIMATE/sourced/correctable. Needs `BRAVE_API_KEY` (.env.local).

**TOTAL axle coverage: 298 variants** (Lovells 215 + Brave 83 net) across 10 makes — Toyota 116 · Isuzu 49
· Ford 46 · Nissan 42 · Mitsubishi 14 · Holden 14 · Mazda 12 · Hyundai/Honda/Subaru 6. **From 0.**

## S2.4 New deps / infra notes
- `@anthropic-ai/sdk` (grounded Claude path) + `@napi-rs/canvas` (PDF render) added to package.json.
- `ANTHROPIC_API_KEY` is now set in `.env.local` ($20 credit; ~$9 spent across grounding+discovery).
- `.150` runs TWO llama.cpp servers: Qwen text on :8082, granite-docling vision on :8085.

## S2.5 Open / follow-ups
- **Tim Rule-11 sign-off** on the 215 Lovells axle ESTIMATEs (gated until ticked / plated).
- **Lovells gaps** — Navara, Triton, Amarok aren't on Lovells → Pedders/Ironman/ARB next (same
  harvest pattern; Pedders needs the browser/VPN path since it bot-blocks).
- **LandCruiser refinement** — our merged LC model lumps 70-series utes + 200/300 wagons; ~25 of
  the 215 may have body-type-wrong axles (landed anyway per Tim, ESTIMATE/correctable).
- **Upgrade-kit axles** — Lovells' *upgraded* figures + CPA codes → `GvmUpgrade` overlays (the moat).
- **User plate-verify UX** — pre-fill these ESTIMATEs, prompt owners to confirm → VERIFIED.
- **Still open from §6:** heavy-junk variant cleanup (the 928 >8t) — NOT done this session.

# SESSION 3 — 2026-06-21 (overnight expansion: multi-field + dimensions + new search angles)

Ran an **automated overnight pipeline** (`ops/overnight-expand.sh`, nohup) + a parallel
**experiment job** (`ops/overnight-experiments.sh`). Result: **axle 298 → 640 variants**,
plus the first real coverage of GCM / tow-ball / overhangs.

## S3.1 What was built
- **Extract core now pulls dimensions** (`manual/extract.ts`): `wheelbaseMm, totalLengthMm,
  frontOverhangMm, rearOverhangMm` added to `ManualSpecs` + the Qwen prompt. Overhang is the
  **CoG-beam geometry** the differentiator consumes — was 0% everywhere.
- **`brave-land` generalised to multi-field** — lands axle **+ GCM/tow/tow-ball/wheelbase/
  length/overhangs**, per-field GVM-consensus, non-clobbering (only fills gaps / refreshes
  MANUAL-CLAUDE; never overwrites ROVER/QLD).
- **Shared `src/lib/spec-fetch/brave-vmap.ts`** — one source of truth for search + land;
  each dork-vehicle maps to **multiple catalogue slugs** (fixes gen-splits: `triton`+
  `triton-lb-lc`, `bt-50`+`bt-50d`…). Added **18 next-tier rigs** (RAM, Silverado, F-150,
  Tundra, Jeep, Land Rover, SsangYong, LDV, GWM, Sprinter, Transit).
- **Incremental + gap-aware pipeline**: `brave-pdf-search` gained `--append` + `--dorks=alt`;
  `brave-extract` gained `--incremental`; `brave-gaps-local.ts` prints vehicles still <N% axle
  → feeds an **alternate-dork second pass** (different phrasings) automatically.
- **Search EXPERIMENTS** (`brave-experiment-local.ts`) — three NEW angles:
  - **A — source-mining** `site:<vendor> filetype:pdf` over 15 AU suspension/GVM-upgrade
    vendors (ultimatesuspension, Pedders, Peninsula4x4, Ironman, Dobinsons…). **The winner:
    26/101 PDFs had factory axle** — a Lovells-grade vein (LandCruiser 80/100/105/200, Prado
    90/120/150, Patrol Y61, Fortuner, FJ Cruiser, Pathfinder).
  - **B — GAWR terminology** (10/109) + **C — GVM-cert** (9/76) — cracked stubborn SUVs
    (CX-5, CR-V, Tucson, Outlander, ASX) that don't print "axle" in AU brochures.
  - `experiment-land-local.ts` lands the experiment finds via a **curated name→model rule
    table** (generic/ambiguous names skipped, never guessed) + **nearest-GVM assignment**
    (each variant takes only its closest-GVM source → no cross-gen overwrite on LandCruiser).

## S3.2 Coverage now (source=MANUAL = this whole axle effort)
- **frontAxleLimitKg: 640 variants** (Toyota 126 · Mercedes/Sprinter 118 · Nissan 62 · Ford 58 ·
  Isuzu 49 · Mazda 38 · Mitsubishi 29 · Holden 14 · Dodge 12 · GWM 8 · Land Rover 7 · Jeep 5 …).
- **GCM +317 · tow-ball +261 · towing +203** (gap-fill over ROVER) · **overhangs 0 → 69/132**
  (front/rear) · wheelbase +94 · length +83.
- **Gaps left: 9** — commodore, captiva, sportage, amarok, jeep gladiator/grand-cherokee,
  ssangyong musso/rexton, ldv t60.
- Brave spend: ~126 (main) + alt pass + 50 (experiments) — well under the $10 / 2900-call cap.

## S3.3 Open / follow-ups (in addition to S2.5)
- **Tim Rule-11 sign-off** now covers **640** axle ESTIMATEs + the new GCM/tow/overhang rows.
- **9 gap vehicles** — most are American/wagon niche; suspension-mining + a manual pass would close.
- **Experiment leftovers** — `.experiment-extracted.jsonl` has finds we skipped (no rule / GVM
  out of range, e.g. LandCruiser 300 gvm 4205, D-Max RG1 gvm 3695) — land once those gens exist.
- **Overhang yield is thin (69/132)** — spec sheets rarely tabulate the F/R split; plate-verify
  + manual deep-dive are the realistic path to fuller CoG geometry.
