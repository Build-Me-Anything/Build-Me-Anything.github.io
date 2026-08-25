# NS-004c: verification rungs forced by the time-step check. At Re 1000 the CFL 0.2 repeat of the 256^3 run reproduced
# it to 0.02 % (peak 51.97 vs 51.96 at the same instant), so the event is NOT chaotically sensitive and the 256^3 value
# is the trustworthy one - which means the 192^3 and 224^3 rungs, which agreed with EACH OTHER to 4.4 %, were both
# about 20 % too high. Two successive rungs agreeing is therefore not proof of convergence.
# That invalidates the convergence verdicts at Re 707 (declared at 224^3) and Re 1414 (declared at 256^3) until each is
# carried one rung further. These are those rungs.
# Launch detached with:
#   powershell -NoProfile -ExecutionPolicy Bypass -File run-ns004c.ps1
# Output: expl-tubes-Re<Re>-N<N>-fp32-gpu/ ; console: run-ns004.console.log
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
$cases = @(
  @{ Re =  707; N = 256 },
  @{ Re = 1414; N = 288 },
  @{ Re = 1000; N = 288 }
)
try {
  foreach ($c in $cases) {
    $Re = $c.Re; $N = $c.N
    $out = Join-Path $PSScriptRoot "expl-tubes-Re$Re-N$N-fp32-gpu"
    if (Test-Path (Join-Path $out 'final.json')) {
      "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: Re=$Re N=$N already has final.json - skipped" | Out-File -Append -Encoding utf8 $log
      continue
    }
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher (ns004c): starting Re=$Re N=$N (float32)" | Out-File -Append -Encoding utf8 $log
    & python -u $script --N $N --ic tubes --Re $Re --tEnd 16 --cfl 0.4 --snap 0.5 --ckpt 2 --fp32 --out $out 2>&1 | Out-File -Append -Encoding utf8 $log
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: Re=$Re N=$N exited" | Out-File -Append -Encoding utf8 $log
  }
} finally {
  [void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS)
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher (ns004c): done" | Out-File -Append -Encoding utf8 $log
}
