# NS-003: antiparallel vortex tubes (Kerr-type, same preset as NS-002), Re 2000, float64 ladder 96^3 -> 192^3 -> 256^3
# on the GPU. Launch detached with:
#   powershell -NoProfile -ExecutionPolicy Bypass -File run-ns003.ps1
# Levels run in sequence; each resumes from its own checkpoint.npz if interrupted; a level whose final.json exists is
# skipped. Keeps the machine awake while running (SetThreadExecutionState, per-process).
# Output: research/nslab/tubes-Re2000-N{96,192,256}-gpu/ ; console: run-ns003.console.log
# (ASCII only: Windows PowerShell 5.1 reads a BOM-less UTF-8 script as ANSI and an em dash becomes a smart quote.)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)   # ...\Build Me Anything
$script = Join-Path $root 'pocket-wind-tunnel\gpu\nslab_gpu.py'
$log = Join-Path $PSScriptRoot 'run-ns003.console.log'
$env:PYTHONIOENCODING = 'utf-8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
"[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: root=$root script=$script" | Out-File -Append -Encoding utf8 $log
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$ES_CONTINUOUS = [uint32]2147483648; $ES_SYSTEM_REQUIRED = [uint32]1
[void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
try {
  foreach ($N in 96, 192, 256) {
    $out = Join-Path $PSScriptRoot "tubes-Re2000-N$N-gpu"
    if (Test-Path (Join-Path $out 'final.json')) {
      "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: N=$N already has final.json - skipped" | Out-File -Append -Encoding utf8 $log
      continue
    }
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: starting N=$N" | Out-File -Append -Encoding utf8 $log
    & python -u $script --N $N --ic tubes --Re 2000 --tEnd 16 --cfl 0.4 --snap 0.5 --ckpt 2 --out $out 2>&1 | Out-File -Append -Encoding utf8 $log
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: N=$N exited" | Out-File -Append -Encoding utf8 $log
  }
} finally {
  [void][Win32.Power]::SetThreadExecutionState($ES_CONTINUOUS)
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] launcher: done" | Out-File -Append -Encoding utf8 $log
}
