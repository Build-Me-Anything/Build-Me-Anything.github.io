#!/usr/bin/env bash
# Rent a card for NSLab — survey, then provision, with a hard stop on the bill.
#
# Deliberately two-step: nothing is created until you pass --go. The survey costs nothing and tells you what is
# actually available at what price; --go creates the pod and stamps an auto-terminate time on it, so a forgotten
# instance cannot run overnight.
#
#   bash provision-runpod.sh --survey            # what fp64 cards are free, where, at what price
#   bash provision-runpod.sh                     # print the plan (no charge, nothing created)
#   bash provision-runpod.sh --go                # create the pod
#   bash provision-runpod.sh --teardown <podId>  # stop the meter
#
# Environment overrides:
#   GPU="NVIDIA A100-SXM4-80GB"   HOURS=8   VOLUME_GB=40   DC=US-KS-2   NAME=nslab   IMAGE=<docker image>
#   NETWORK_VOLUME=1              # storage that outlives the pod (bills per GB-month; needs DC)
#
# Why an A100/H100 and not a 4090: NVIDIA runs FP64 at 1/64 rate on GeForce silicon and 1/32 on most workstation
# Ampere, so a 4090 is 5-10x slower than an A100 on this solver despite the lower hourly rate. The solver is also
# bandwidth-bound, so HBM bandwidth is the number that matters, not the FLOP headline. For float32 exploration a
# 4090 is excellent value and this script is the wrong tool - use the laptop.
set -euo pipefail

# Git Bash / MSYS rewrites any argument that looks like a Unix absolute path into a Windows path before the exe
# sees it, so '--volume-mount-path /workspace' reaches RunPod as 'C:/Program Files/Git/workspace' and the volume
# mounts somewhere useless. Observed, not theoretical - it cost a pod. These two switches turn the rewrite off.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

RUNPODCTL=${RUNPODCTL:-runpodctl}
command -v "$RUNPODCTL" >/dev/null 2>&1 || RUNPODCTL="/c/Users/User/bin/runpodctl.exe"

GPU=${GPU:-"NVIDIA A100-SXM4-80GB"}
HOURS=${HOURS:-8}
VOLUME_GB=${VOLUME_GB:-40}
DC=${DC:-}
NAME=${NAME:-nslab}
# 0 = a pod-local volume at /workspace, created and destroyed with the pod. Right for a short on-demand run: no
#     standing storage bill, no datacenter lock-in. Pull the results off before terminating.
# 1 = a network volume, which outlives the pod. Worth it when a reclaim would actually hurt (spot/community
#     pricing, multi-hour runs) or when several pods in sequence share one dataset. Bills per GB-month until
#     you delete it, whether or not a pod is attached.
NETWORK_VOLUME=${NETWORK_VOLUME:-0}
# CuPy brings its own CUDA libraries, so the image only has to supply Python, pip and sshd - nothing CUDA at all.
# The PyTorch images are ~25 GB and on a cold host the pull can take 15 minutes you are paying for; the Ubuntu
# base is ~2 GB. Watch 'runtimeStatusReason: awaiting_container' - that is the pull, and it is billable time.
IMAGE=${IMAGE:-runpod/base:1.0.2-ubuntu2204}

MODE=${1:-plan}

if [ "$MODE" = "--teardown" ]; then
  POD=${2:?usage: provision-runpod.sh --teardown <podId>}
  echo "=== deleting pod $POD"
  echo "    (the verb is 'delete'. 'pod terminate' is not a subcommand and runpodctl answers it by printing the"
  echo "     help text and exiting 0 - so a teardown that used it looked like it worked and did not.)"
  echo "    (a NETWORK volume, if you made one, survives this and keeps billing — delete it separately"
  echo "     with 'runpodctl network-volume delete <id>' once the data is off it)"
  "$RUNPODCTL" pod delete "$POD"
  echo "=== pods still running:"
  "$RUNPODCTL" pod list
  exit 0
fi

echo "=== account"
"$RUNPODCTL" user || {
  echo "STOP: no API key. Get one at https://console.runpod.io/user/settings then run:"
  echo "        runpodctl config --apiKey <key>"
  exit 1
}

if [ "$MODE" = "--survey" ]; then
  echo
  echo "=== gpu types (want: full-rate fp64 and enough VRAM — A100, H100, H200)"
  "$RUNPODCTL" gpu list
  echo
  echo "=== datacenters"
  "$RUNPODCTL" datacenter list
  echo
  echo "Then:  GPU=\"<gpu id>\" DC=<datacenter> bash provision-runpod.sh --go"
  exit 0
fi

TERMINATE_AT=$(python -c "import datetime; print((datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=$HOURS)).strftime('%Y-%m-%dT%H:%M:%SZ'))")

if [ "$NETWORK_VOLUME" = 1 ]; then
  STORAGE_DESC="${VOLUME_GB} GB NETWORK volume (${NAME}-vol) at /workspace — outlives the pod, so a reclaim or a
                     termination keeps every checkpoint. Bills per GB-month until deleted."
  BILL_DESC="the pod (per hour while running) and the network volume (per GB-month until deleted)."
else
  STORAGE_DESC="${VOLUME_GB} GB pod-local volume at /workspace — created and destroyed with the pod, so there is
                     no standing storage bill. Pull the results off before terminating."
  BILL_DESC="the pod, per hour while it runs. Nothing else."
fi

cat <<PLAN

=== plan
  GPU                $GPU  x1, SECURE cloud
  image              $IMAGE
  storage            $STORAGE_DESC
  auto-terminate     $TERMINATE_AT  (${HOURS} h from now — the cost guard)
  datacenter         ${DC:-<any with stock>}

  Billable: $BILL_DESC

PLAN

if [ "$MODE" != "--go" ]; then
  echo "Dry run. Nothing was created. Re-run with --go to provision, or --survey to see what is available."
  exit 0
fi

STORAGE_ARGS=()
if [ "$NETWORK_VOLUME" = 1 ]; then
  if [ -z "$DC" ]; then
    echo "STOP: a network volume lives in one datacenter and the pod must be created in the same one, so set"
    echo "      DC=<datacenter id>. Run --survey to see which datacenters have the card in stock."
    exit 1
  fi
  echo "=== creating the network volume"
  VOL_JSON=$("$RUNPODCTL" network-volume create --name "${NAME}-vol" --size "$VOLUME_GB" --data-center-id "$DC")
  echo "$VOL_JSON"
  VOL_ID=$(python -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('id') or d.get('networkVolumeId') or '')" <<<"$VOL_JSON")
  [ -n "$VOL_ID" ] || { echo "STOP: could not read the volume id out of the response above."; exit 1; }
  echo "volume: $VOL_ID"
  STORAGE_ARGS=(--network-volume-id "$VOL_ID" --volume-mount-path /workspace)
else
  STORAGE_ARGS=(--volume-in-gb "$VOLUME_GB" --volume-mount-path /workspace)
fi
if [ -n "$DC" ]; then STORAGE_ARGS+=(--data-center-ids "$DC"); fi

echo "=== creating the pod"
"$RUNPODCTL" pod create \
  --name "$NAME" \
  --image "$IMAGE" \
  --gpu-id "$GPU" \
  --gpu-count 1 \
  --cloud-type SECURE \
  --container-disk-in-gb 20 \
  "${STORAGE_ARGS[@]}" \
  --ports '22/tcp' \
  --terminate-after "$TERMINATE_AT" \
  --wait

cat <<'NEXT'

=== next, on the pod (ssh in with the command printed above, or use the web terminal)

  # 1. pennies: does the grid fit, and how many hours will it take on this card?
  BENCH_ONLY=1 N=288 bash <(curl -sL https://raw.githubusercontent.com/Build-Me-Anything/Build-Me-Anything.github.io/main/cloud/run-cloud.sh)

  # 2. the real thing — grades the card against the archived run first, then runs detached
  N=288 bash <(curl -sL https://raw.githubusercontent.com/Build-Me-Anything/Build-Me-Anything.github.io/main/cloud/run-cloud.sh)

  # 3. when it finishes, send the small files home (not the checkpoint)
  tar czf /workspace/nslab-N288.tgz -C /workspace/runs/tubes-Re2000-N288-gpu final.json run.log slices
  runpodctl send /workspace/nslab-N288.tgz        # prints a one-time code
  # then on the laptop:  runpodctl receive <code>

=== stop the meter when you are done
  bash provision-runpod.sh --teardown <podId>

NEXT
