param([string]$Org = 'Build-Me-Anything')

# Set up the GitHub organisation profile: description, website, repository topics, and the org profile
# README that GitHub renders on the organisation's front page.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\User\OneDrive\Build Me Anything\outreach\github-profile.ps1"
#
# The profile README has to live in a repository literally named ".github", at profile/README.md. This script
# creates that repository if it is missing and writes the file through the contents API, so there is no second
# clone to manage. Safe to re-run: it updates in place.
#
# (ASCII only: Windows PowerShell 5.1 misreads a BOM-less UTF-8 script. Not 'Stop': a native executable
# writing to stderr - which gh does for an expected 404 - would otherwise terminate the script.)

$ErrorActionPreference = 'Continue'

function Test-Gh { param([scriptblock]$Command) & $Command 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) }
function Invoke-Checked {
  param([string]$What, [scriptblock]$Command)
  $out = & $Command 2>&1
  if ($LASTEXITCODE -ne 0) { $out | ForEach-Object { Write-Host ("    " + $_) }; throw "$What failed (exit $LASTEXITCODE)" }
  return $out
}

$root = Split-Path -Parent $PSScriptRoot
$site = "https://" + $Org.ToLower() + ".github.io"
$repo = "$Org.github.io"

Write-Host "organisation : $Org"
Write-Host "site         : $site"

# --- 1. organisation metadata --------------------------------------------------------------------------------
# Deliberately no location and no public email: the programme is pseudonymous by choice.
Write-Host ""
Write-Host "setting the organisation description and website"
Invoke-Checked "gh api orgs" {
  gh api -X PATCH "orgs/$Org" `
    -f name="Build Me Anything" `
    -f description="An offline wind tunnel that grew a verified Navier-Stokes laboratory. Numerical evidence, graded before it is believed." `
    -f blog=$site
} | Out-Null

# --- 2. repository metadata ----------------------------------------------------------------------------------
Write-Host "setting the repository homepage and topics"
Invoke-Checked "gh api repos" {
  gh api -X PATCH "repos/$Org/$repo" -f homepage=$site
} | Out-Null

$topics = @(
  'computational-fluid-dynamics', 'navier-stokes', 'direct-numerical-simulation', 'pseudo-spectral',
  'aerodynamics', 'turbulence', 'scientific-computing', 'zero-dependencies', 'offline-first', 'cfd'
)
$topicArgs = @()
foreach ($t in $topics) { $topicArgs += '-f'; $topicArgs += "names[]=$t" }
Invoke-Checked "gh api topics" { gh api -X PUT "repos/$Org/$repo/topics" @topicArgs } | Out-Null

# --- 3. the .github repository that holds the org profile README ---------------------------------------------
Write-Host ""
if (Test-Gh { gh api "repos/$Org/.github" }) {
  Write-Host ".github repository already exists"
} else {
  Write-Host "creating $Org/.github"
  Invoke-Checked "gh repo create" {
    gh repo create "$Org/.github" --public --description "Organisation profile for Build Me Anything."
  } | Out-Null
}

# Upload the profile README and the images it references. The contents API needs the current blob sha when
# replacing a file that is already there, so each one is create-or-update.
function Publish-File {
  param([string]$LocalPath, [string]$RepoPath)
  if (-not (Test-Path $LocalPath)) { throw "missing $LocalPath" }
  $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($LocalPath))
  $sha = ''
  $existing = & gh api "repos/$Org/.github/contents/$RepoPath" --jq '.sha' 2>$null
  if ($LASTEXITCODE -eq 0 -and $existing) { $sha = ([string]$existing).Trim() }
  Write-Host ("  " + $RepoPath + $(if ($sha) { "  (update)" } else { "  (create)" }))
  if ($sha) {
    Invoke-Checked "upload $RepoPath" {
      gh api -X PUT "repos/$Org/.github/contents/$RepoPath" -f message="Update the organisation profile" -f content=$b64 -f sha=$sha
    } | Out-Null
  } else {
    Invoke-Checked "upload $RepoPath" {
      gh api -X PUT "repos/$Org/.github/contents/$RepoPath" -f message="Add the organisation profile" -f content=$b64
    } | Out-Null
  }
}

$gh = Join-Path $root 'outreach\github'
Write-Host "uploading the profile"
Publish-File (Join-Path $gh 'profile-README.md') 'profile/README.md'
foreach ($img in 'hero.png', 'peaks-light.png', 'peaks-dark.png', 'bridge.png') {
  Publish-File (Join-Path $gh "assets\$img") "profile/assets/$img"
}

Write-Host ""
Write-Host "done."
Write-Host ("  organisation : https://github.com/{0}" -f $Org)
Write-Host ("  repository   : https://github.com/{0}/{1}" -f $Org, $repo)
Write-Host ""
Write-Host "Two things the API cannot do - both one click each, on https://github.com/$Org :"
Write-Host "  1. Pin the repository:  the 'pin repositories' link on the org overview."
Write-Host "  2. Social preview image (the card shown when the repo is linked on Reddit, HN, Slack):"
Write-Host "     repository Settings -> General -> Social preview -> Upload."
Write-Host "     Use outreach\reddit\profile-banner-1920.png - it is already the right shape."
