# NS-003 exploration ladder: antiparallel tubes, Re 2000, FLOAT32 (exploration only - not evidence grade), 256^3 -> 288^3 -> 320^3,
# anchored on the float64 256^3 level of NS-003. Asks the decisive question: does max|omega| flatten beyond 256^3 at Re 2000?
# 384^3 does not fit the 6 GB card in any precision (float32 pages at 15 s/step); 320^3 float32 runs at 0.84 s/step.
# Launch detached with:
#   powershell -NoProfile -ExecutionPolicy Bypass -File run-ns003-fp32.ps1
# Output folders are deliberately named outside the analyse.js ladder prefix (expl-...) so they never enter the evidence ladder.
# (ASCII only: Windows PowerShell 5.1 reads a BOM-less UTF-8 script as ANSI and an em dash becomes a smart quote.)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # ...\Build Me Anything
$script = Join-Path $root 'pocket-wind-tunnel\gpu\nslab_gpu.py'
$log = Join-Path $PSScriptRoot 'run-ns003-fp32.console.log'
$env:PYTHONIOENCODING = 'utf-8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: root=$root script=$script" | Out-File -Append -Encoding utf8 $log
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$ES_CONTINUOUS = [uint32]2147483648; $ES_SYSTEM_REQUIRED = [uint32]1
[void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
try {
  foreach ($N in 256, 288, 320) {
    $out = Join-Path $PSScriptRoot "expl-tubes-Re2000-N$N-fp32-gpu"
    if (Test-Path (Join-Path $out 'final.json')) {
      "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: N=$N already has final.json - skipped" | Out-File -Append -Encoding utf8 $log
      continue
    }
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: starting N=$N (float32)" | Out-File -Append -Encoding utf8 $log
    & python -u $script --N $N --ic tubes --Re 2000 --tEnd 16 --cfl 0.4 --snap 0.5 --ckpt 2 --fp32 --out $out 2>&1 | Out-File -Append -Encoding utf8 $log
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: N=$N exited" | Out-File -Append -Encoding utf8 $log
  }
} finally {
  [void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS)
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: done" | Out-File -Append -Encoding utf8 $log
}
