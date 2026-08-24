# NS-004: Reynolds ladder of CONVERGED peaks. Antiparallel tubes (the NS-002/003 initial condition) at
# Re = 707, 1000, 1414 (with Re = 2000 already in hand from NS-003b), each run at two resolutions chosen so the
# pointwise maximum can be shown to flatten at that Reynolds number - the first study that compares a converged
# max|omega| across Re, which only became possible once NS-003b flattened the peak at Re 2000.
#
# Resolution guess N ~ Re^(3/4) anchored on Re 2000 -> 288 (NS-003b): 1414 -> 224, 1000 -> 192, 707 -> 160,
# with a coarser partner rung 0.8N each to measure the level-to-level change. FLOAT32 (exploration grade, same
# status as NS-003b), anchored by the float64 NS-003 ladder at Re 2000.
# Launch detached with:
#   powershell -NoProfile -ExecutionPolicy Bypass -File run-ns004.ps1
# Output: expl-tubes-Re<Re>-N<N>-fp32-gpu/ ; console: run-ns004.console.log
# (ASCII only: Windows PowerShell 5.1 reads a BOM-less UTF-8 script as ANSI and an em dash becomes a smart quote.)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # ...\Build Me Anything
$script = Join-Path $root 'pocket-wind-tunnel\gpu\nslab_gpu.py'
$log = Join-Path $PSScriptRoot 'run-ns004.console.log'
$env:PYTHONIOENCODING = 'utf-8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: root=$root script=$script" | Out-File -Append -Encoding utf8 $log
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$ES_CONTINUOUS = [uint32]2147483648; $ES_SYSTEM_REQUIRED = [uint32]1
[void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
$cases = @(
  @{ Re = 1414; N = 192 }, @{ Re = 1414; N = 224 },
  @{ Re = 1000; N = 160 }, @{ Re = 1000; N = 192 },
  @{ Re =  707; N = 128 }, @{ Re =  707; N = 160 }
)
try {
  foreach ($c in $cases) {
    $Re = $c.Re; $N = $c.N
    $out = Join-Path $PSScriptRoot "expl-tubes-Re$Re-N$N-fp32-gpu"
    if (Test-Path (Join-Path $out 'final.json')) {
      "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: Re=$Re N=$N already has final.json - skipped" | Out-File -Append -Encoding utf8 $log
      continue
    }
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: starting Re=$Re N=$N (float32)" | Out-File -Append -Encoding utf8 $log
    & python -u $script --N $N --ic tubes --Re $Re --tEnd 16 --cfl 0.4 --snap 0.5 --ckpt 2 --fp32 --out $out 2>&1 | Out-File -Append -Encoding utf8 $log
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: Re=$Re N=$N exited" | Out-File -Append -Encoding utf8 $log
  }
} finally {
  [void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS)
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: done" | Out-File -Append -Encoding utf8 $log
}
