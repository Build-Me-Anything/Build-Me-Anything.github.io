# NS-004 time-step / reproducibility check on the anomalous rung. At Re 1000 the 256^3 level came in 15 % BELOW its
# 192^3 and 224^3 partners and its max|omega| history changes shape after t ~ 9.2 (peak at t 9.0 then falling, instead
# of climbing to t 9.4) - while E(16) agrees across all four rungs to 3e-5. Two possible readings:
#   (a) the reconnection at this Reynolds number is chaotically sensitive, so no single run's peak is meaningful;
#   (b) the 256^3 run is the trustworthy one and the coarser rungs over-predict.
# Halving the step at fixed resolution separates them: if the peak is step-insensitive (as it was at Re 4000, where
# CFL 0.2 moved it 0.002 %), the differences are spatial and (b) holds; if the peak moves by several per cent, the
# event is sensitive and no peak at this Re is converged.
# Launch detached with:
#   powershell -NoProfile -ExecutionPolicy Bypass -File run-ns004-dtcheck.ps1
# Output: expl-tubes-Re1000-dtcheck-N256-cfl02-fp32-gpu/ (outside the ladder prefix on purpose)
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
  $out = Join-Path $PSScriptRoot 'expl-tubes-Re1000-dtcheck-N256-cfl02-fp32-gpu'
  if (-not (Test-Path (Join-Path $out 'final.json'))) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: dt-check Re=1000 N=256 CFL 0.2 (float32)" | Out-File -Append -Encoding utf8 $log
    & python -u $script --N 256 --ic tubes --Re 1000 --tEnd 16 --cfl 0.2 --snap 0.5 --ckpt 2 --fp32 --out $out 2>&1 | Out-File -Append -Encoding utf8 $log
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: dt-check exited" | Out-File -Append -Encoding utf8 $log
  }
} finally {
  [void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS)
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher (dtcheck): done" | Out-File -Append -Encoding utf8 $log
}
