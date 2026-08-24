param([string]$Org)

# Publish the Build Me Anything repository and the NSLab logbook to GitHub Pages.
#
# Run from a normal PowerShell, signed in with: gh auth login
#   powershell -NoProfile -ExecutionPolicy Bypass -File "outreach\publish.ps1"
#   powershell -NoProfile -ExecutionPolicy Bypass -File "outreach\publish.ps1" -Org SomeOtherName
#
# Safe to re-run: it creates what is missing and pushes what is committed. It never force-pushes.
# (ASCII only: Windows PowerShell 5.1 misreads a BOM-less UTF-8 script.)
#
# Every gh/git call is checked against $LASTEXITCODE. PowerShell does NOT raise an error when a native
# executable fails, so without these checks the script reports success after a string of 404s - which is
# exactly what the first version did.

# NOT 'Stop'. Windows PowerShell 5.1 turns any stderr written by a native executable into a terminating
# error when the preference is Stop - so `gh api repos/...` answering "404, no such repo", which is the
# expected answer when asking whether something exists, would kill the script. Every native call below is
# therefore checked explicitly against $LASTEXITCODE, which is the only reliable signal.
$ErrorActionPreference = 'Continue'

function Invoke-Checked {
  param([string]$What, [scriptblock]$Command)
  $out = & $Command 2>&1
  if ($LASTEXITCODE -ne 0) {
    $out | ForEach-Object { Write-Host ("    " + $_) }
    throw "$What failed (exit $LASTEXITCODE)"
  }
  return $out
}

# A yes/no probe: run it, swallow the output and the noise, report only whether it succeeded.
function Test-Gh {
  param([scriptblock]$Command)
  & $Command 2>&1 | Out-Null
  return ($LASTEXITCODE -eq 0)
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "working in $root"

# --- who is signed in ---------------------------------------------------------------------------------------
$who = Invoke-Checked "gh api user" { gh api user --jq '.login' }
$uid = Invoke-Checked "gh api user" { gh api user --jq '.id' }
Write-Host "signed in as $who (id $uid)"

# --- resolve the owner: an organisation if one exists, otherwise the account -----------------------------------
if (-not $Org) { $Org = 'Build-Me-Anything' }
if (-not (Test-Gh { gh api "orgs/$Org" --jq '.login' })) {
  Write-Host ""
  Write-Host "There is no organisation called '$Org' on GitHub."
  Write-Host "Create it at https://github.com/organizations/plan (Free plan, then the second step names it),"
  Write-Host "or re-run with -Org TheNameYouActuallyUsed, or with -Org $who to publish under your account."
  throw "owner '$Org' not found"
}
Write-Host "owner: $Org (organisation)"

# An org site must be named <org>.github.io; a user site must be named <user>.github.io.
$repo = "$Org.github.io"
$site = "https://" + $Org.ToLower() + ".github.io"
Write-Host "target: $Org/$repo  ->  $site"

# --- create the repository if it does not exist ----------------------------------------------------------------
if (Test-Gh { gh api "repos/$Org/$repo" }) {
  Write-Host "repository already exists"
} else {
  Write-Host "creating public repository $Org/$repo"
  Invoke-Checked "gh repo create" {
    gh repo create "$Org/$repo" --public `
      --description "The Pocket Wind Tunnel: an offline aerodynamics toolkit that grew a verified Navier-Stokes laboratory, and the logbook of the NSLab research programme." `
      --homepage $site
  } | Out-Null
}

# --- commit anything outstanding, with the pseudonymous identity ---------------------------------------------
Invoke-Checked "git config" { git config user.name  "Michael" } | Out-Null
Invoke-Checked "git config" { git config user.email "$uid+$who@users.noreply.github.com" } | Out-Null
if (git status --porcelain) {
  Write-Host "committing outstanding changes"
  Invoke-Checked "git add"    { git add -A } | Out-Null
  Invoke-Checked "git commit" { git commit -q -m "Update the logbook and the research archive" } | Out-Null
}

# --- push -------------------------------------------------------------------------------------------------------
$url = "https://github.com/$Org/$repo.git"
if (git remote) {
  Invoke-Checked "git remote set-url" { git remote set-url origin $url } | Out-Null
} else {
  Invoke-Checked "git remote add"     { git remote add origin $url } | Out-Null
}
Invoke-Checked "git branch" { git symbolic-ref HEAD refs/heads/main } | Out-Null
Write-Host "pushing to $url"
Invoke-Checked "git push" { git push -u origin main }

# --- switch Pages to the Actions build ------------------------------------------------------------------------
Write-Host "configuring GitHub Pages to build from the workflow"
$pagesOk = Test-Gh { gh api -X POST "repos/$Org/$repo/pages" -f build_type=workflow }
if (-not $pagesOk) {
  # Already enabled: switch the existing site over to the workflow build instead of creating one.
  $pagesOk = Test-Gh { gh api -X PUT "repos/$Org/$repo/pages" -f build_type=workflow }
}
if ($pagesOk) {
  Write-Host "Pages set to build from GitHub Actions"
} else {
  Write-Host "COULD NOT set the Pages build type automatically."
  Write-Host "Do it by hand: Settings -> Pages -> Build and deployment -> Source: GitHub Actions"
}

Write-Host ""
Write-Host "pushed."
Write-Host ("  repository: https://github.com/{0}/{1}" -f $Org, $repo)
Write-Host ("  site:       {0}" -f $site)
Write-Host ("  workflow:   https://github.com/{0}/{1}/actions" -f $Org, $repo)
Write-Host ""
Write-Host "The first Pages build takes a minute or two. If the site 404s, check the Actions tab."
