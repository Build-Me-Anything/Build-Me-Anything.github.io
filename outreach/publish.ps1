# Publish the Build Me Anything repository and the NSLab logbook to GitHub Pages.
#
# Run from a normal (non-elevated) PowerShell, signed in with: gh auth login
#   powershell -NoProfile -ExecutionPolicy Bypass -File "outreach\publish.ps1"
#
# Safe to re-run: it creates what is missing and pushes whatever is committed. It never force-pushes.
# (ASCII only: Windows PowerShell 5.1 misreads a BOM-less UTF-8 script.)

param([string]$Org)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "working in $root"

# --- who is signed in ------------------------------------------------------------------------------------
$who = (gh api user --jq '.login')
$uid = (gh api user --jq '.id')
if (-not $who) { throw "gh is not signed in. Run: gh auth login" }
Write-Host "signed in as $who (id $uid)"

# --- find the organisation -------------------------------------------------------------------------------
$orgs = @(gh api user/orgs --jq '.[].login')
Write-Host ("organisations visible: " + ($(if ($orgs.Count) { $orgs -join ', ' } else { '(none)' })))
if ($Org) { $org = $Org } else {
  $org = $orgs | Where-Object { ($_ -replace '-', '') -ieq 'buildmeanything' } | Select-Object -First 1
}
if (-not $org) {
  Write-Host ""
  Write-Host "Could not see an organisation called Build-Me-Anything."
  Write-Host "If you created it, the token may lack the read:org scope - run: gh auth refresh -s read:org"
  Write-Host "If it is named differently, re-run this script with the name as an argument:"
  Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File outreach\publish.ps1 -Org TheName"
  throw "organisation not found"
}
$repo = "$org.github.io"
Write-Host "target: $org/$repo"

# --- create the repository if it does not exist -----------------------------------------------------------
$exists = $true
try { gh api "repos/$org/$repo" 2>$null | Out-Null } catch { $exists = $false }
if ($exists) {
  Write-Host "repository already exists"
} else {
  Write-Host "creating public repository $org/$repo"
  gh repo create "$org/$repo" --public --description "The Pocket Wind Tunnel: an offline aerodynamics toolkit that grew a verified Navier-Stokes laboratory, and the logbook of the NSLab research programme." --homepage "https://$($org.ToLower()).github.io"
}

# --- commit anything outstanding, with the pseudonymous identity -------------------------------------------
git config user.name  "Michael"
git config user.email "$uid+$who@users.noreply.github.com"
$dirty = git status --porcelain
if ($dirty) {
  Write-Host "committing outstanding changes"
  git add -A
  git commit -q -m "Update the logbook and the research archive"
}

# --- push ---------------------------------------------------------------------------------------------------
$url = "https://github.com/$org/$repo.git"
if (git remote) { git remote set-url origin $url } else { git remote add origin $url }
git symbolic-ref HEAD refs/heads/main
Write-Host "pushing to $url"
git push -u origin main

# --- switch Pages to the Actions build ------------------------------------------------------------------------
Write-Host "configuring GitHub Pages to build from the workflow"
try {
  gh api -X POST "repos/$org/$repo/pages" -f build_type=workflow | Out-Null
  Write-Host "Pages enabled"
} catch {
  try {
    gh api -X PUT "repos/$org/$repo/pages" -f build_type=workflow | Out-Null
    Write-Host "Pages already enabled; build type set to workflow"
  } catch {
    Write-Host "Could not set the Pages build type automatically."
    Write-Host "Set it by hand: Settings -> Pages -> Build and deployment -> Source: GitHub Actions"
  }
}

Write-Host ""
Write-Host "done."
Write-Host ("  repository: https://github.com/{0}/{1}" -f $org, $repo)
Write-Host ("  site:       https://{0}.github.io" -f $org.ToLower())
Write-Host ("  workflow:   https://github.com/{0}/{1}/actions" -f $org, $repo)
Write-Host ""
Write-Host "The first Pages build takes a minute or two. If the site 404s, check the Actions tab."
