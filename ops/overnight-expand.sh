#!/usr/bin/env bash
#
# Overnight catalogue spec-expansion run. Three goals, sequenced so the safe/free wins
# bank FIRST and the long/risky extract runs last (so a late failure can't lose the
# early gains). NOT `set -e` — we deliberately continue past a failed step and land
# whatever data exists.
#
#   1. Land the existing extracted data (axle + GCM/tow + the gen-split fan-out) — free.
#   2. Main dork pass over the full vehicle list (old + next-tier) → extract (now with
#      dimensions) → land every field.
#   3. Gap analysis → alternate-dork pass (different phrasings/sources) on whatever still
#      lacks axle → incremental extract → land.
#
# Brave budget: step 2 ~117 calls (cap 150), step 6 ~ up to 100. Total well under the
# session limit. Local extract (.150 docling/qwen) is free, just time (~2h for ~700 PDFs).
#
# Launch (survives the session closing):
#   nohup bash ops/overnight-expand.sh > ops/n8n/.overnight.out 2>&1 &
#
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

LOG=ops/n8n/.overnight.log
: > "$LOG"

log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }

# --- env: pull the vars the standalone jobs need from .env.local (grep is robust to a
#     missing trailing newline; strip surrounding quotes and any stray CR) ---
envget() { grep -m1 "^$1=" .env.local | cut -d= -f2- | tr -d '"'; }
export DATABASE_URL="$(envget DATABASE_URL)"
export BRAVE_API_KEY="$(envget BRAVE_API_KEY)"
for opt in DOCLING_BASE_URL QWEN_BASE_URL QWEN_MODEL; do
  val="$(envget "$opt")"; [ -n "$val" ] && export "$opt=$val"
done

if [ -z "${DATABASE_URL:-}" ] || [ -z "${BRAVE_API_KEY:-}" ]; then
  log "FATAL: DATABASE_URL or BRAVE_API_KEY missing from .env.local"; exit 1
fi
log "env ok · DB=$(echo "$DATABASE_URL" | sed -E 's#.*@([^/]+)/.*#\1#') · brave key present"

run() { log "→ $*"; "$@" >> "$LOG" 2>&1; log "   exit=$?"; }

# ── STEP 1: bank the existing extracted data (free, no Brave) ──────────────────────────
log "STEP 1/8 — land existing extracted data (axle + GCM/tow + gen-split fan-out)"
run npx tsx src/jobs/brave-land-local.ts --write

# ── STEP 2: main dork pass over the full vehicle list ──────────────────────────────────
log "STEP 2/8 — Brave main-dork search (full vehicle list)"
run npx tsx src/jobs/brave-pdf-search-local.ts --max-queries=150

# ── STEP 3: extract all candidates (fresh — now captures dimensions) ───────────────────
log "STEP 3/8 — extract all candidates (with dimensions)"
run npx tsx src/jobs/brave-extract-local.ts

# ── STEP 4: land every field ───────────────────────────────────────────────────────────
log "STEP 4/8 — land all fields"
run npx tsx src/jobs/brave-land-local.ts --write

# ── STEP 5: gap analysis ───────────────────────────────────────────────────────────────
log "STEP 5/8 — gap analysis (vehicles still <1% axle)"
GAPS=$(npx tsx src/jobs/brave-gaps-local.ts --min-pct=1 2>> "$LOG")
log "gap vehicles: ${GAPS:-<none>}"

# ── STEP 6-8: alternate-dork gap pass ──────────────────────────────────────────────────
if [ -n "${GAPS:-}" ]; then
  log "STEP 6/8 — Brave alt-dork gap search (append, gap vehicles only)"
  run npx tsx src/jobs/brave-pdf-search-local.ts --append --dorks=alt --vehicles="$GAPS" --max-queries=100
  log "STEP 7/8 — incremental extract (only the new candidates)"
  run npx tsx src/jobs/brave-extract-local.ts --incremental
  log "STEP 8/8 — land all fields (final)"
  run npx tsx src/jobs/brave-land-local.ts --write
else
  log "STEP 6-8 — skipped (no gaps)"
fi

# ── final coverage report ──────────────────────────────────────────────────────────────
log "── FINAL COVERAGE ──"
npx tsx src/jobs/brave-gaps-local.ts --min-pct=1 >> "$LOG" 2>> "$LOG"
log "OVERNIGHT RUN COMPLETE"
