#!/usr/bin/env bash
# One pod, three runs, back to back — the rungs NS-004 still needs.
#
#   1. Re 1414, 384^3, float64   (~1.4 h)  the ladder was still moving at 288^3
#   2. Re 1000, 384^3, float64   (~1.4 h)  same
#   3. Re 2000, 640^3, float32   (~5.5 h)  the 288/320/384 plateau broke at 512^3 (+22.6 %); this is the next rung,
#                                          and 640^3 in float64 would need 94 GB, so it goes in single precision —
#                                          justified because fp32 and fp64 agree to every printed digit at 256^3,
#                                          288^3 and 320^3 in this exact configuration.
#
# The parity check runs once (the card is graded before it is trusted, like every run in this programme); the rest
# reuse it via SKIP_PARITY. Each run is checkpointed every 2 time units, so an interruption costs minutes.
# Results are tarred per run — small files only, never the checkpoint.
set -uo pipefail
WORK=${WORK:-/workspace}
RC="$WORK/run-cloud.sh"
cd "$WORK"

[ -f "$RC" ] || curl -sL https://raw.githubusercontent.com/Build-Me-Anything/Build-Me-Anything.github.io/main/cloud/run-cloud.sh -o "$RC"

log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$WORK/ladder.log"; }

run_one() {   # run_one <Re> <N> <fp32flag 0|1> <skipParity 0|1>
  local RE=$1 N=$2 FP=$3 SKIP=$4
  local TAG="tubes-Re${RE}-N${N}-gpu"
  [ "$FP" = 1 ] && TAG="expl-tubes-Re${RE}-N${N}-fp32-gpu"
  if [ -f "$WORK/runs/$TAG/final.json" ]; then log "SKIP $TAG (already has final.json)"; return 0; fi
  log "START Re=$RE N=$N fp32=$FP"
  N=$N RE=$RE FP32=$FP SKIP_PARITY=$SKIP OUT="$WORK/runs/$TAG" bash "$RC" >> "$WORK/ladder.log" 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then log "FAILED Re=$RE N=$N (exit $rc) — stopping the ladder"; return $rc; fi
  # run-cloud.sh launches under nohup; wait for the run to produce final.json
  while [ ! -f "$WORK/runs/$TAG/final.json" ]; do
    pgrep -f "nslab_gpu.py" >/dev/null || { sleep 20; [ -f "$WORK/runs/$TAG/final.json" ] || { log "FAILED $TAG: solver exited without final.json"; return 1; }; }
    sleep 60
  done
  log "DONE  $TAG  $(grep -o 'DONE:.*' "$WORK/runs/$TAG/run.log" | tail -1)"
  tar czf "$WORK/${TAG}.tgz" -C "$WORK/runs/$TAG" final.json run.log slices 2>/dev/null
  log "packed $WORK/${TAG}.tgz ($(du -h "$WORK/${TAG}.tgz" | cut -f1))"
}

run_one 1414 384 0 0 && run_one 1000 384 0 1 && run_one 2000 640 1 1
log "LADDER COMPLETE"
ls -lh "$WORK"/*.tgz 2>/dev/null | tee -a "$WORK/ladder.log"
