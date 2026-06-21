#!/usr/bin/env bash
# Self-driving ROVER pipeline — chains the whole sequence so it "keeps rolling".
#
#   0. wait for the in-flight expand to finish
#   1. NORMALISE + CLEAN + CLASSIFY  (resolve base make/model, mark second-stage, set
#      secondStageType) — this is what stops an upgrade kit (e.g. "Ironman Toyota Hilux")
#      from ever becoming a standalone make: it's tagged isSecondStage + GVM_UPGRADE and
#      routed to an overlay; promote-base only ever takes isSecondStage=false.
#   2. promote the recent slice (base variants + GVM-upgrade overlays)
#   3. BIG backfill discovery (ASC full sweep) → new skeleton rows
#   4. NORMALISE + CLEAN + CLASSIFY again (covers the freshly-discovered rows)
#   5. expand the new UNFETCHED rows (loops until drained / no progress)
#   6. promote everything (base + GVM-upgrade overlays)
#
# Every ROVER fetch is done by n8n over the AU VPN; this script only calls n8n + the
# local DB/app. Idempotent + resumable at each step. Reads secrets from .env.local.
set -uo pipefail
cd "$(dirname "$0")/.."

env_val() { grep "^$1=" .env.local | cut -d= -f2- | tr -d '"'; }
export DATABASE_URL="$(env_val DATABASE_URL)"
export ROVER_EXPAND_WEBHOOK_URL="$(env_val ROVER_EXPAND_WEBHOOK_URL)"
export ROVER_INGEST_TOKEN="$(env_val ROVER_INGEST_TOKEN)"
export N8N_BASE_URL="$(env_val N8N_BASE_URL)"
# Post ingest to the app INTERNALLY to bypass the public nginx 1MB edge (the ROVER
# hop is still the VPN — only the n8n→app return hop changes).
export APP_BASE_URL="http://172.16.1.239:3070"

say() { echo "[$(date '+%F %T')] $*"; }
run() { say "RUN: $*"; "$@" 2>&1 | sed 's/^/    /'; say "→ exit ${PIPESTATUS[0]}"; }
unfetched() {
  docker exec tb-postgres psql "$DATABASE_URL" -tAc \
    "select count(*) from \"RoverApprovalIndex\" where \"expandState\"='UNFETCHED';" | tr -d ' '
}

normalise() {
  run npx tsx src/jobs/rover-normalize-local.ts
  run npx tsx src/jobs/rover-clean-base-model-local.ts
  run npx tsx src/jobs/rover-classify-second-stage-local.ts
}
promote() {
  run npx tsx src/jobs/rover-promote-base-local.ts
  run npx tsx src/jobs/rover-promote-gvm-upgrade-bulk-local.ts
}
expand_until_drained() {
  local rounds=0 prev cur
  cur="$(unfetched)"
  while [ "${cur:-0}" -gt 0 ] && [ "$rounds" -lt 6 ]; do
    say "expand round $((rounds + 1)): UNFETCHED=$cur"
    npx tsx src/jobs/rover-expand-bulk-local.ts --min=12 --max=25 2>&1 | sed 's/^/    /'
    rounds=$((rounds + 1))
    prev="$cur"; cur="$(unfetched)"
    say "after round $rounds: UNFETCHED=$cur"
    [ "${cur:-0}" -eq 0 ] && { say "expand fully drained"; break; }
    [ "${cur:-0}" -eq "${prev:-0}" ] && { say "no progress (rate-limited or stuck) — stopping; re-run later to resume"; break; }
    say "10-min cool-down before next expand round (politeness)"; sleep 600
  done
}

say "=== ROVER pipeline START ==="

# 0. let the in-flight expand finish first (don't double live-portal load)
say "waiting for current expand process to exit…"
while pgrep -f 'rover-expand-bulk-local.ts' >/dev/null 2>&1; do sleep 60; done
say "in-flight expand finished. UNFETCHED now: $(unfetched)"

# 1+2. normalise/classify the recent slice, then promote it
say "--- phase A: normalise + promote the recent slice ---"
normalise
promote

# 3. BIG backfill discovery (the full RAV sweep)
say "--- phase B: backfill discovery (full sweep) ---"
run npx tsx src/jobs/rover-backfill-discover-local.ts

# 4. normalise/classify the freshly-discovered rows
say "--- phase C: normalise + classify the new rows ---"
normalise

# 5. expand the new UNFETCHED rows
say "--- phase D: expand the new rows ---"
expand_until_drained

# 6. promote everything
say "--- phase E: final promote (base + GVM-upgrade overlays) ---"
promote

say "=== ROVER pipeline COMPLETE — catalogue counts ==="
docker exec tb-postgres psql "$DATABASE_URL" -tAc \
  "select 'makes',count(*) from \"VehicleMake\" union all select 'models',count(*) from \"VehicleModel\" union all select 'variants',count(*) from \"VehicleVariant\" union all select 'gvm_overlays',count(*) from \"GvmUpgrade\";" 2>&1 | sed 's/^/    /'
