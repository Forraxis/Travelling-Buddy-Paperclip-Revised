#!/usr/bin/env bash
#
# VAN PASS — camper / motorhome base vehicles (Ducato, Transporter, Crafter, Vito,
# Transit, HiAce, Trafic, Master, iLoad/iMax/Staria, LDV, Boxer). Vans publish factory
# axle (GAWR), so this should convert at a high rate — the load-on-the-van CoG case is
# core to the differentiator. Same pipeline, van-scoped vehicle list.
#
# Launch: nohup bash ops/van-pass.sh > ops/n8n/.vanpass.out 2>&1 &
#
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

LOG=ops/n8n/.vanpass.log
: > "$LOG"
log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }
run() { log "→ $*"; "$@" >> "$LOG" 2>&1; log "   exit=$?"; }

envget() { grep -m1 "^$1=" .env.local | cut -d= -f2- | tr -d '"'; }
export DATABASE_URL="$(envget DATABASE_URL)"
export BRAVE_API_KEY="$(envget BRAVE_API_KEY)"
for opt in DOCLING_BASE_URL QWEN_BASE_URL QWEN_MODEL; do
  val="$(envget "$opt")"; [ -n "$val" ] && export "$opt=$val"
done
[ -z "${DATABASE_URL:-}" ] && { log "FATAL: no DATABASE_URL"; exit 1; }
[ -z "${BRAVE_API_KEY:-}" ] && { log "FATAL: no BRAVE_API_KEY"; exit 1; }
log "env ok · DB=$(echo "$DATABASE_URL" | sed -E 's#.*@([^/]+)/.*#\1#')"

VANS="fiat ducato,peugeot boxer,mercedes-benz vito,volkswagen crafter,volkswagen transporter,volkswagen caddy,ford transit,toyota granvia,toyota hiace,hyundai imax,hyundai staria,hyundai iload,renault trafic,renault master,ldv g10,ldv v80,ldv deliver 9"

log "STEP 1/5 — Brave main-dork search (van nameplates)"
run npx tsx src/jobs/brave-pdf-search-local.ts --vehicles="$VANS" --max-queries=70

log "STEP 2/5 — extract all van candidates (with dimensions)"
run npx tsx src/jobs/brave-extract-local.ts

log "STEP 3/5 — land all fields (GVM routes to the right van model/gen)"
run npx tsx src/jobs/brave-land-local.ts --write

log "STEP 4/5 — gap check (van nameplates still <1% axle) → alt-dork pass"
GAPS=$(npx tsx src/jobs/brave-gaps-local.ts --min-pct=1 2>> "$LOG" | tr ',' '\n' \
  | grep -iE 'ducato|boxer|vito|crafter|transporter|caddy|transit|granvia|hiace|imax|staria|iload|trafic|master|ldv' | paste -sd, -)
log "van gaps: ${GAPS:-<none>}"
if [ -n "${GAPS:-}" ]; then
  run npx tsx src/jobs/brave-pdf-search-local.ts --append --dorks=alt --vehicles="$GAPS" --max-queries=60
  run npx tsx src/jobs/brave-extract-local.ts --incremental
  run npx tsx src/jobs/brave-land-local.ts --write
fi

log "STEP 5/5 — final van coverage"
npx tsx src/jobs/brave-gaps-local.ts --min-pct=1 >> "$LOG" 2>> "$LOG"
log "VAN PASS COMPLETE"
