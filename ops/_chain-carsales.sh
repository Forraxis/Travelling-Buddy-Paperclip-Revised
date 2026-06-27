#!/usr/bin/env bash
# Auto-chain: the SECOND the CCS caravan scan finishes —
#   PHASE 1 (always, no .150 needed): re-aggregate ALL caravan sources + land to the catalogue.
#   PHASE 2 (needs .150 extract box): materialise the carsales-17 gap vehicles
#           (Brave search -> docling/qwen extract -> land). If .150 down, reports + skips.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
LOG=ops/n8n/.chain-carsales.log
: > "$LOG"
log(){ echo "[$(date -Is)] $*" | tee -a "$LOG"; }

envget(){ grep -m1 "^$1=" .env.local | cut -d= -f2- | tr -d '"'; }
export DATABASE_URL="$(envget DATABASE_URL)"
export BRAVE_API_KEY="$(envget BRAVE_API_KEY)"
for o in DOCLING_BASE_URL QWEN_BASE_URL QWEN_MODEL; do v="$(envget "$o")"; [ -n "$v" ] && export "$o=$v"; done

V17="gwm tank 300,gwm tank 500,gwm cannon alpha,gwm haval h6,gwm haval h7,gwm haval jolion,mazda cx-60,mazda cx-70,mazda cx-80,mazda cx-90,ford bronco,ford e-transit,jeep avenger,jeep renegade,volkswagen tayron,volkswagen id buzz,nissan ariya"

log "armed — waiting for CCS caravan scan to finish…"
while pgrep -f 'caravan-ccs-scan.py' >/dev/null; do sleep 30; done
log "CCS caravan scan FINISHED."

# ── PHASE 1: caravan re-aggregate + land (free, local, no .150) ─────────────────────────
log "PHASE 1 — caravan aggregate (all sources, clean model names, RedBook/dealer split)"
python3 ops/caravan-listings-aggregate.py >> "$LOG" 2>&1; log "  aggregate exit=$?"
log "PHASE 1 — caravan land (--write)"
npx tsx src/jobs/caravan-listings-land-local.ts --write >> "$LOG" 2>&1; log "  land exit=$?"
log "PHASE 1 complete — caravan catalogue landed."

# ── PHASE 2: carsales-17 materialise (needs .150 docling:8085 + qwen:8082) ──────────────
DOCLING_OK=$(curl -s --max-time 8 http://172.16.45.150:8085/v1/models -o /dev/null -w '%{http_code}' 2>/dev/null)
QWEN_OK=$(curl -s --max-time 8 http://172.16.45.150:8082/v1/models -o /dev/null -w '%{http_code}' 2>/dev/null)
if [ "$DOCLING_OK" != "200" ] || [ "$QWEN_OK" != "200" ]; then
  log "PHASE 2 SKIPPED: .150 extract services down (docling:8085=$DOCLING_OK qwen:8082=$QWEN_OK)."
  log "  -> the 17 are in VMAP; re-run 'bash ops/_chain-carsales.sh' or overnight-expand.sh when up."
  exit 0
fi
log "PHASE 2 — extract services OK (docling:8085 + qwen:8082) — materialising carsales-17."
log "  STEP 1/3 — Brave search (17 gap vehicles)"
npx tsx src/jobs/brave-pdf-search-local.ts --vehicles="$V17" --max-queries=60 >> "$LOG" 2>&1; log "    exit=$?"
log "  STEP 2/3 — extract new candidates (.150 docling/qwen)"
npx tsx src/jobs/brave-extract-local.ts --incremental >> "$LOG" 2>&1; log "    exit=$?"
log "  STEP 3/3 — land all fields"
npx tsx src/jobs/brave-land-local.ts --write >> "$LOG" 2>&1; log "    exit=$?"
log "PHASE 2 complete — carsales-17 materialised. ALL DONE."
