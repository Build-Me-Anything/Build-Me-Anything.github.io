# NS-004d: 384^3 rungs at Re 1414 and Re 1000, float32.
# Motivation: the Re 2000 ladder plateaued across THREE rungs (288/320/384 within 0.8 %, health PASS) and then moved
# +22.6 % at 512^3 (interp 134.1 -> 164.4). Re 1414 and Re 1000 were last seen still moving at 288^3, so 384^3 is the
# next rung for both. Expect them to keep moving; the point is to measure by how much, not to hope for a plateau.
#
# COST WARNING: 384^3 float32 needs ~6.4 GB and this card has 6 GB, so it pages - measured 14.9 s/step, about 13 h per
# run, ~26 h for both, sequential. Checkpoints every 2 time units mean an interrupted run resumes. On the A100 that
# produced the float64 Re 2000 rungs these are minutes; if that route is available, prefer it and delete these.
# Launch detached with:
#   powershell -NoProfile -ExecutionPolicy Bypass -File run-ns004d.ps1
# Output: expl-tubes-Re<Re>-N384-fp32-gpu/ ; console: run-ns004.console.log
# (ASCII only: Windows PowerShell 5.1 reads a BOM-less UTF-8 script as ANSI and an em dash becomes a smart quote.)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script = Join-Path $root 'pocket-wind-tunnel\gpu\nslab_gpu.py'
$log = Join-Path $PSScriptRoot 'run-ns004.console.log'
$env:PYTHONIOENCODING = 'utf-8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$ES_CONTINUOUS = [uint32]2147483648; $ES_SYSTEM_REQUIRED = [uint32]1
[void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
try {
  foreach ($Re in 1414, 1000) {
    $out = Join-Path $PSScriptRoot "expl-tubes-Re$Re-N384-fp32-gpu"
    if (Test-Path (Join-Path $out 'final.json')) {
      "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher (ns004d): Re=$Re N=384 already has final.json - skipped" | Out-File -Append -Encoding utf8 $log
      continue
    }
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher (ns004d): starting Re=$Re N=384 (float32, expect ~13 h)" | Out-File -Append -Encoding utf8 $log
    & python -u $script --N 384 --ic tubes --Re $Re --tEnd 16 --cfl 0.4 --snap 0.5 --ckpt 2 --fp32 --out $out 2>&1 | Out-File -Append -Encoding utf8 $log
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher (ns004d): Re=$Re N=384 exited" | Out-File -Append -Encoding utf8 $log
  }
} finally {
  [void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS)
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher (ns004d): done" | Out-File -Append -Encoding utf8 $log
}
