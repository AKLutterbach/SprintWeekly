# Forge Clone App Testing Script
# Creates a test clone of the Marketplace app with a new Forge app ID

$ErrorActionPreference = "Stop"

# Configuration
$originalRepo = "C:\Users\aklut\Documents\JiraBuild\Sprint-Weekly"
$testRepo = "C:\Users\aklut\Documents\JiraBuild\Sprint-Weekly-Test"
$jiraSite = "datainsightlab.atlassian.net"
$product = "jira"
$environment = "development"
$logFile = "$testRepo\clone-test-log.txt"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Forge Clone App Testing Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Safety confirmation
Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "  1. Copy $originalRepo to $testRepo" -ForegroundColor White
Write-Host "  2. Register a NEW Forge app ID in the test folder" -ForegroundColor White
Write-Host "  3. Deploy and install the test clone to $jiraSite" -ForegroundColor White
Write-Host ""
Write-Host "WARNING: The test folder's manifest.yml WILL BE MODIFIED." -ForegroundColor Red
Write-Host "The original repo at $originalRepo will NOT be touched." -ForegroundColor Green
Write-Host ""

$confirmation = Read-Host "Type 'CLONE' to continue, or anything else to cancel"
if ($confirmation -ne "CLONE") {
    Write-Host "Cancelled." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Starting clone process..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy repository with exclusions
Write-Host "[1/8] Copying repository (excluding build artifacts)..." -ForegroundColor Yellow

# Remove test folder if it exists
if (Test-Path $testRepo) {
    Write-Host "  Removing existing test folder..." -ForegroundColor Gray
    Remove-Item -Path $testRepo -Recurse -Force
}

# Copy with robocopy
$robocopyArgs = @(
    $originalRepo,
    $testRepo,
    "/E",
    "/XD", "node_modules", "dist", ".parcel-cache", ".turbo", "coverage", ".next", "build", "out", ".forge", "static\sprint-report\node_modules", "static\sprint-report\build",
    "/XF", "package-lock.json", ".DS_Store", "*.log",
    "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"
)

$robocopyResult = & robocopy @robocopyArgs 2>&1

if ($LASTEXITCODE -ge 8) {
    Write-Host "  Error copying files (robocopy exit code: $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

Write-Host "  Done. Test folder created at: $testRepo" -ForegroundColor Green
Write-Host ""

# Step 2: Verify original unchanged
Write-Host "[2/8] Verifying original repo is unchanged..." -ForegroundColor Yellow
$originalAppId = Select-String -Path "$originalRepo\manifest.yml" -Pattern "id:\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() }
Write-Host "  Original Marketplace app ID: $originalAppId" -ForegroundColor Green
Write-Host ""

# Step 3: Navigate to test folder
Write-Host "[3/8] Navigating to test folder..." -ForegroundColor Yellow
Set-Location $testRepo
Write-Host "  Current directory: $(Get-Location)" -ForegroundColor Green
Write-Host ""

# Step 4: Check current test manifest
Write-Host "[4/8] Checking test manifest before registration..." -ForegroundColor Yellow
$testAppIdBefore = Select-String -Path ".\manifest.yml" -Pattern "id:\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() }
Write-Host "  Test app ID (before registration): $testAppIdBefore" -ForegroundColor Gray
Write-Host ""

# Step 5: Register new app
Write-Host "[5/8] Registering new Forge app..." -ForegroundColor Yellow
Write-Host "  This will modify manifest.yml in the TEST folder only." -ForegroundColor Gray
Write-Host "  You will be prompted for an app name (suggest: 'Sprint Weekly Test Clone')" -ForegroundColor Gray
Write-Host ""

# Start logging
Start-Transcript -Path $logFile -Append

forge register

Stop-Transcript

Write-Host ""
Write-Host "  Registration complete." -ForegroundColor Green
Write-Host ""

# Step 6: Verify new app ID
Write-Host "[6/8] Verifying new app ID created..." -ForegroundColor Yellow
$testAppIdAfter = Select-String -Path ".\manifest.yml" -Pattern "id:\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value.Trim() }

Write-Host ""
Write-Host "  === COMPARISON ===" -ForegroundColor Cyan
Write-Host "  Original (Marketplace): $originalAppId" -ForegroundColor Green
Write-Host "  Test Clone:             $testAppIdAfter" -ForegroundColor Yellow
Write-Host ""

if ($originalAppId -eq $testAppIdAfter) {
    Write-Host "  ERROR: App IDs are identical! Registration may have failed." -ForegroundColor Red
    Write-Host "  STOPPING to prevent modifying Marketplace app." -ForegroundColor Red
    exit 1
}

Write-Host "  Success: App IDs are different. Safe to proceed." -ForegroundColor Green
Write-Host ""

# Step 7: Install dependencies
Write-Host "[7/8] Installing dependencies..." -ForegroundColor Yellow
Write-Host "  Installing root dependencies..." -ForegroundColor Gray
npm install 2>&1 | Out-Null

if (Test-Path "static\sprint-report\package.json") {
    Write-Host "  Building static assets..." -ForegroundColor Gray
    Push-Location static\sprint-report
    npm install 2>&1 | Out-Null
    npm run build 2>&1 | Out-Null
    Pop-Location
}

Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# Step 8: Deploy
Write-Host "[8/8] Deploying and installing test clone..." -ForegroundColor Yellow
Write-Host "  Deploying to $environment environment..." -ForegroundColor Gray

Start-Transcript -Path $logFile -Append
forge deploy --environment $environment
Stop-Transcript

Write-Host ""
Write-Host "  Installing to $jiraSite ($product)..." -ForegroundColor Gray
Write-Host "  You may be prompted to confirm scopes." -ForegroundColor Gray
Write-Host ""

Start-Transcript -Path $logFile -Append
forge install --site $jiraSite --product $product --environment $environment
Stop-Transcript

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Clone and Test Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "VERIFICATION STEPS:" -ForegroundColor Yellow
Write-Host "1. Open Jira: https://$jiraSite" -ForegroundColor White
Write-Host "2. Go to Settings > Apps > Manage apps" -ForegroundColor White
Write-Host "3. Look for 'Sprint Weekly Test Clone' with DEV badge" -ForegroundColor White
Write-Host ""
Write-Host "TEST APP LOCATION:" -ForegroundColor Yellow
Write-Host "  $testRepo" -ForegroundColor White
Write-Host "  App ID: $testAppIdAfter" -ForegroundColor White
Write-Host ""
Write-Host "MARKETPLACE APP LOCATION (DO NOT MODIFY):" -ForegroundColor Yellow
Write-Host "  $originalRepo" -ForegroundColor White
Write-Host "  App ID: $originalAppId" -ForegroundColor White
Write-Host ""
Write-Host "LOG FILE:" -ForegroundColor Yellow
Write-Host "  $logFile" -ForegroundColor White
Write-Host ""
Write-Host "To uninstall test clone:" -ForegroundColor Yellow
Write-Host "  cd $testRepo" -ForegroundColor Cyan
Write-Host '  forge uninstall --site datainsightlab.atlassian.net --product jira --environment development' -ForegroundColor Cyan
Write-Host ""
