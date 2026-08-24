#!/usr/bin/env bash
# Rent a card for NSLab — survey, then provision, with a hard stop on the bill.
#
# Everything here is deliberately two-step: nothing is created until you pass --go. The survey costs nothing and
# tells you what is actually available at what price; the provision step creates exactly two billable things, a
# network volume and a pod, and stamps an auto-terminate time on the pod so a forgotten instance cannot run up a
# bill overnight.
#
#   bash provision-runpod.sh --survey            # what fp64 cards are free, and what do they cost
#   bash provision-runpod.sh                     # print the plan (no charge, nothing created)
#   bash provision-runpod.sh --go                # create the volume and the pod
#   bash provision-runpod.sh --teardown <podId>  # stop the meter
#
# Environment overrides:
#   GPU="NVIDIA A100 80GB PCIe"   HOURS=8   VOLUME_GB=50   DC=US-KS-2   NAME=nslab   IMAGE=<docker image>
#
# Why an A100/H100 and not a 4090: NVIDIA runs FP64 at 1/64 rate on GeForce silicon and 1/32 on most workstation
# Ampere, so a 4090 is 5-10x slower than an A100 on this solver despite the lower hourly rate. The solver is also
# bandwidth-bound, so HBM is the number that matters, not the FLOP headline. For float32 exploration a 4090 is
# excellent value and this script is the wrong tool - use the laptop.
set -euo pipefail

RUNPODCTL=${RUNPODCTL:-runpodctl}
command -v "$RUNPODCTL" >/dev/null 2>&1 || RUNPODCTL="/c/Users/User/bin/runpodctl.exe"

GPU=${GPU:-"NVIDIA A100 80GB PCIe"}
HOURS=${HOURS:-8}
VOLUME_GB=${VOLUME_GB:-50}
DC=${DC:-}
NAME=${NAME:-nslab}
# A CUDA 12 image with Python. CuPy brings its own CUDA libraries, so the base image only has to be recent enough
# for the driver; any current RunPod PyTorch image works and they are pre-cached on the hosts, which saves minutes.
IMAGE=${IMAGE:-runpod/pytorch:1.0.3-cu1281-torch291-ubuntu2404}

MODE=${1:-plan}

if [ "$MODE" = "--teardown" ]; then
  POD=${2:?usage: provision-runpod.sh --teardown <podId>}
  echo "=== terminating pod $POD (the network volume is kept — delete it separately when the data is off it)"
  "$RUNPODCTL" pod terminate "$POD"
  exit 0
fi

echo "=== account"
"$RUNPODCTL" user || { echo "STOP: no API key. Get one at https://console.runpod.io/user/settings then run:"; echo "        runpodctl config --apiKey <key>"; exit 1; }

if [ "$MODE" = "--survey" ]; then
  echo
  echo "=== gpu types (look for A100 / H100: full-rate fp64 and >= 40 GB)"
  "$RUNPODCTL" gpu list
  echo
  echo "=== datacenters and availability"
  "$RUNPODCTL" datacenter list
  echo
  echo "Pick a GPU id and a datacenter that has it, then:"
  echo "  GPU=\"<gpu id>\" DC=<datacenter> bash provision-runpod.sh --go"
  exit 0
fi

TERMINATE_AT=$(python -c "import datetime; print((datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=$HOURS)).strftime('%Y-%m-%dT%H:%M:%SZ'))")

cat <<PLAN

=== plan
  GPU                $GPU  x1, SECURE cloud
  image              $IMAGE
  network volume     ${NAME}-vol, ${VOLUME_GB} GB, mounted at /workspace
                     (a NETWORK volume, not pod-local: it outlives the pod, so a reclaimed
                      spot instance or a terminated pod keeps every checkpoint)
  auto-terminate     $TERMINATE_AT  (${HOURS} h from now — the cost guard)
  datacenter         ${DC:-<the volume's, chosen below>}

  Two billable things are created: the pod (per hour, while running) and the volume
  (per GB-month, prorated — 50 GB is a few pence a day). Nothing else.

PLAN

if [ "$MODE" != "--go" ]; then
  echo "Dry run. Nothing was created. Re-run with --go to provision, or --survey to see what is available."
  exit 0
fi

if [ -z "$DC" ]; then
  echo "STOP: set DC=<datacenter id>. A network volume lives in one datacenter and the pod must be created in the"
  echo "      same one, so the datacenter has to be chosen before either exists. Run --survey to see the list."
  exit 1
fi

echo "=== creating the network volume"
VOL_JSON=$("$RUNPODCTL" network-volume create --name "${NAME}-vol" --size "$VOLUME_GB" --data-center-id "$DC")
echo "$VOL_JSON"
VOL_ID=$(python -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('id') or d.get('networkVolumeId') or '')" <<<"$VOL_JSON")
[ -n "$VOL_ID" ] || { echo "STOP: could not read the volume id out of the response above."; exit 1; }
echo "volume: $VOL_ID"

echo "=== creating the pod"
"$RUNPODCTL" pod create \
  --name "$NAME" \
  --image "$IMAGE" \
  --gpu-id "$GPU" \
  --gpu-count 1 \
  --cloud-type SECURE \
  --container-disk-in-gb 40 \
  --network-volume-id "$VOL_ID" \
  --volume-mount-path /workspace \
  --ports '22/tcp' \
  --terminate-after "$TERMINATE_AT" \
  --wait

cat <<'NEXT'

=== next, on the pod (ssh in with the command printed above)

  # 1. cheap: does the grid fit, and how many hours will it take?
  BENCH_ONLY=1 N=288 bash <(curl -sL https://raw.githubusercontent.com/Build-Me-Anything/Build-Me-Anything.github.io/main/cloud/run-cloud.sh)

  # 2. the real thing (grades the card against the archive first, then runs detached)
  N=288 bash <(curl -sL https://raw.githubusercontent.com/Build-Me-Anything/Build-Me-Anything.github.io/main/cloud/run-cloud.sh)

  # 3. when it finishes, send the small files home (not the checkpoint)
  tar czf /workspace/nslab-N288.tgz -C /workspace/runs/tubes-Re2000-N288-gpu final.json run.log slices
  runpodctl send /workspace/nslab-N288.tgz        # prints a one-time code
  # then on the laptop:  runpodctl receive <code>

=== stop the meter when you are done
  bash provision-runpod.sh --teardown <podId>

NEXT
