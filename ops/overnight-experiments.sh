#!/usr/bin/env bash
#
# Second overnight job: SEARCH EXPERIMENTS (new angles for factory axle data). Waits for
# the main overnight-expand run to finish first, so the two don't contend on the local AI
# (.150) or the Brave rate limit. Discovery + report only — lands nothing.
#
# Launch: nohup bash ops/overnight-experiments.sh > ops/n8n/.experiments.out 2>&1 &
#
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

LOG=ops/n8n/.experiments.log
: > "$LOG"
log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }

envget() { grep -m1 "^$1=" .env.local | cut -d= -f2- | tr -d '"'; }
export DATABASE_URL="$(envget DATABASE_URL)"
export BRAVE_API_KEY="$(envget BRAVE_API_KEY)"
for opt in DOCLING_BASE_URL QWEN_BASE_URL QWEN_MODEL; do
  val="$(envget "$opt")"; [ -n "$val" ] && export "$opt=$val"
done

# Wait for the main run to finish (poll its PID file).
MAINPID="$(cat ops/n8n/.overnight.pid 2>/dev/null || echo '')"
if [ -n "$MAINPID" ]; then
  log "waiting for main run (PID $MAINPID) to finish before starting…"
  while kill -0 "$MAINPID" 2>/dev/null; do sleep 60; done
  log "main run finished — starting experiments"
else
  log "no main PID found — starting experiments now"
fi

log "running experiment search (budget 200 Brave queries)"
npx tsx src/jobs/brave-experiment-local.ts --max-queries=200 >> "$LOG" 2>&1
log "EXPERIMENTS COMPLETE"
