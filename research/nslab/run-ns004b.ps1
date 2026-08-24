# NS-004b: third rungs for the Reynolds ladder. The first pass (run-ns004.ps1) showed that a pair of rungs at a
# refinement ratio of ~1.2 is not enough at any Reynolds number: Re 1414 moved +12.9 % from 192 to 224 and Re 1000
# moved +19.2 % from 160 to 192 - the same +19 % step Re 2000 made from 256 to 288 immediately before it flattened.
# Working hypothesis: convergence is threshold-like (a rung either resolves the reconnection bridge or it does not),
# with the threshold N scaling roughly as Re^0.35 anchored on Re 2000 -> 288. These rungs test that.
# Launch detached with:
#   powershell -NoProfile -ExecutionPolicy Bypass -File run-ns004b.ps1
# Output: expl-tubes-Re<Re>-N<N>-fp32-gpu/ ; console: run-ns004.console.log (shared with the first pass)
# (ASCII only: Windows PowerShell 5.1 reads a BOM-less UTF-8 script as ANSI and an em dash becomes a smart quote.)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # ...\Build Me Anything
$script = Join-Path $root 'pocket-wind-tunnel\gpu\nslab_gpu.py'
$log = Join-Path $PSScriptRoot 'run-ns004.console.log'
$env:PYTHONIOENCODING = 'utf-8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher (ns004b): root=$root" | Out-File -Append -Encoding utf8 $log
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$ES_CONTINUOUS = [uint32]2147483648; $ES_SYSTEM_REQUIRED = [uint32]1
[void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
# Ordered cheapest first so the picture fills in early; the launcher skips any level that already has final.json.
$cases = @(
  @{ Re =  707; N = 192 },
  @{ Re = 1000; N = 224 },
  @{ Re = 1414; N = 256 },
  @{ Re =  707; N = 224 },
  @{ Re = 1000; N = 256 }
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
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher (ns004b): done" | Out-File -Append -Encoding utf8 $log
}
