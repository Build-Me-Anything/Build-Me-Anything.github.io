# Overnight NSLab batch: Taylor–Green Re 1600 at 192³ (resolved by kmax·η ≥ 1). Launch detached with:
#   powershell -NoProfile -ExecutionPolicy Bypass -File run-192.ps1
# Keeps the machine awake while running (SetThreadExecutionState, a per-process request — nothing is changed in
# the power plan); resumes from checkpoint.bin if the run was interrupted. Output: research/nslab/tgv-Re1600-N192/
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # ...\Build Me Anything
$out = Join-Path $PSScriptRoot 'tgv-Re1600-N192'
$script = Join-Path $root 'pocket-wind-tunnel\test\run-ns-long.js'
$log = Join-Path $PSScriptRoot 'run-192.console.log'
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: root=$root script=$script" | Out-File -Append -Encoding utf8 $log
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$ES_CONTINUOUS = [uint32]2147483648; $ES_SYSTEM_REQUIRED = [uint32]1
[void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
try {
  & node --max-old-space-size=4096 $script --N 192 --Re 1600 --tEnd 16 --cfl 0.4 --snap 0.5 --ckpt 2 --out $out 2>&1 | Out-File -Append -Encoding utf8 $log
} finally {
  [void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS)
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: node exited" | Out-File -Append -Encoding utf8 $log
}
