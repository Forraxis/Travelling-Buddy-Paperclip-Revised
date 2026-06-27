#!/usr/bin/env bash
# Phase 2 only: materialise the carsales-17 gap vehicles (Brave key now fixed).
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
LOG=ops/n8n/.carsales-phase2.log
: > "$LOG"
log(){ echo "[$(date -Is)] $*" | tee -a "$LOG"; }
envget(){ grep -m1 "^$1=" .env.local | cut -d= -f2- | tr -d '"'; }
export DATABASE_URL="$(envget DATABASE_URL)"
export BRAVE_API_KEY="$(envget BRAVE_API_KEY)"
for o in DOCLING_BASE_URL QWEN_BASE_URL QWEN_MODEL; do v="$(envget "$o")"; [ -n "$v" ] && export "$o=$v"; done

V17="gwm tank 300,gwm tank 500,gwm cannon alpha,gwm haval h6,gwm haval h7,gwm haval jolion,mazda cx-60,mazda cx-70,mazda cx-80,mazda cx-90,ford bronco,ford e-transit,jeep avenger,jeep renegade,volkswagen tayron,volkswagen id buzz,nissan ariya"

log "STEP 1/3 — Brave search (17 carsales gap vehicles)"
npx tsx src/jobs/brave-pdf-search-local.ts --vehicles="$V17" --max-queries=80 >> "$LOG" 2>&1; log "  exit=$?"
log "STEP 2/3 — extract new candidates (.150 docling/qwen)"
npx tsx src/jobs/brave-extract-local.ts --incremental >> "$LOG" 2>&1; log "  exit=$?"
log "STEP 3/3 — land all fields"
npx tsx src/jobs/brave-land-local.ts --write >> "$LOG" 2>&1; log "  exit=$?"
log "carsales-17 materialise COMPLETE."
