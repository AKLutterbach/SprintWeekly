# Forge CLI Hard Reset Script for Windows
# This script performs a complete reset of Forge CLI authentication state
# CAUTION: This will delete local credential files and unset environment variables

Write-Host "========================================" -ForegroundColor Red
Write-Host "Forge CLI HARD RESET" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "  1. Remove FORGE_* environment variables (session and persistent)" -ForegroundColor White
Write-Host "  2. Delete local Forge credential files" -ForegroundColor White
Write-Host "  3. Reinstall Forge CLI globally" -ForegroundColor White
Write-Host "  4. Prompt for fresh login (token not persisted)" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Type 'RESET' to continue, or anything else to cancel"
if ($confirmation -ne "RESET") {
    Write-Host "Cancelled." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Starting hard reset..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Unset session environment variables
Write-Host "[1/7] Removing FORGE_* environment variables from current session..." -ForegroundColor Yellow
Remove-Item Env:FORGE_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:FORGE_API_TOKEN -ErrorAction SilentlyContinue
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# Step 2: Remove persistent user environment variables from registry
Write-Host "[2/7] Removing FORGE_* environment variables from HKCU:\Environment..." -ForegroundColor Yellow
try {
    $regPath = "HKCU:\Environment"
    
    # Check and remove FORGE_EMAIL
    $forgeEmail = Get-ItemProperty -Path $regPath -Name "FORGE_EMAIL" -ErrorAction SilentlyContinue
    if ($forgeEmail) {
        Remove-ItemProperty -Path $regPath -Name "FORGE_EMAIL" -ErrorAction Stop
        Write-Host "  Removed: FORGE_EMAIL from persistent environment" -ForegroundColor Green
    } else {
        Write-Host "  FORGE_EMAIL was not set" -ForegroundColor Gray
    }
    
    # Check and remove FORGE_API_TOKEN
    $forgeToken = Get-ItemProperty -Path $regPath -Name "FORGE_API_TOKEN" -ErrorAction SilentlyContinue
    if ($forgeToken) {
        Remove-ItemProperty -Path $regPath -Name "FORGE_API_TOKEN" -ErrorAction Stop
        Write-Host "  Removed: FORGE_API_TOKEN from persistent environment" -ForegroundColor Green
    } else {
        Write-Host "  FORGE_API_TOKEN was not set" -ForegroundColor Gray
    }
    
    Write-Host "  Done." -ForegroundColor Green
} catch {
    Write-Host "  Error removing registry keys: $_" -ForegroundColor Red
}
Write-Host ""

# Step 3: Delete local credential files
Write-Host "[3/7] Deleting local Forge credential files..." -ForegroundColor Yellow

$filesToDelete = @(
    "$PSScriptRoot\.forge-credentials",
    "$PSScriptRoot\.forge",
    "$env:USERPROFILE\.forge",
    "$env:USERPROFILE\.config\forge",
    "$env:APPDATA\forge",
    "$env:LOCALAPPDATA\forge"
)

foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Recurse -Force -ErrorAction Stop
            Write-Host "  Deleted: $file" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to delete: $file - $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  Not found: $file" -ForegroundColor Gray
    }
}
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# Step 4: Windows Credential Manager manual instructions
Write-Host "[4/7] Windows Credential Manager (MANUAL ACTION REQUIRED)" -ForegroundColor Yellow
Write-Host "  Forge CLI may not use Windows Credential Manager directly," -ForegroundColor Gray
Write-Host "  but to be thorough, check for any Atlassian/Forge entries:" -ForegroundColor Gray
Write-Host ""
Write-Host "  Manual Steps:" -ForegroundColor White
Write-Host "    1. Press Win+R, type 'control /name Microsoft.CredentialManager', press Enter" -ForegroundColor Cyan
Write-Host "    2. Click 'Windows Credentials'" -ForegroundColor Cyan
Write-Host "    3. Look for any entries containing 'atlassian.com' or 'forge'" -ForegroundColor Cyan
Write-Host "    4. Expand each entry and click 'Remove'" -ForegroundColor Cyan
Write-Host ""
$credConfirm = Read-Host "  Press Enter after you've checked (or press Enter to skip)"
Write-Host ""

# Step 5: Logout from Forge
Write-Host "[5/7] Logging out from Forge CLI..." -ForegroundColor Yellow
forge logout 2>&1 | Out-Null
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# Step 6: Reinstall Forge CLI
Write-Host "[6/7] Reinstalling Forge CLI globally (this may take 1-2 minutes)..." -ForegroundColor Yellow
Write-Host "  Uninstalling..." -ForegroundColor Gray
npm uninstall -g @forge/cli 2>&1 | Out-Null
Write-Host "  Installing latest version..." -ForegroundColor Gray
npm install -g @forge/cli 2>&1 | Out-Null
Write-Host "  Done." -ForegroundColor Green
Write-Host ""

# Step 7: Fresh login (no persistence)
Write-Host "[7/7] Fresh Forge login (session only, NOT persisted)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  IMPORTANT: Do NOT set env vars permanently." -ForegroundColor Red
Write-Host "  We will use 'forge login' interactive mode." -ForegroundColor White
Write-Host ""
Write-Host "  Before logging in, make sure you have:" -ForegroundColor Yellow
Write-Host "    - Your Atlassian email (e.g., user@example.com)" -ForegroundColor Cyan
Write-Host "    - A FRESH API token from: https://id.atlassian.com/manage/api-tokens" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Tip: Create a NEW token named 'Forge CLI Reset - $(Get-Date -Format 'yyyy-MM-dd')'" -ForegroundColor Gray
Write-Host ""

$loginConfirm = Read-Host "  Press Enter when ready to login"
Write-Host ""

# Run forge login
forge login

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Verification" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Verify login with verbose output
Write-Host "Running 'forge whoami --verbose' to verify authentication..." -ForegroundColor Yellow
Write-Host ""
forge whoami --verbose

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Hard Reset Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. If 'forge whoami' succeeded, authentication is fixed!" -ForegroundColor White
Write-Host "2. Proceed with deployment:" -ForegroundColor White
Write-Host "     forge deploy --environment production" -ForegroundColor Cyan
Write-Host "3. Then install:" -ForegroundColor White
Write-Host "     forge install --upgrade --site datainsightlab.atlassian.net --product jira --environment production" -ForegroundColor Cyan
Write-Host ""
Write-Host "WARNING: Your credentials are NOW only in this PowerShell session." -ForegroundColor Red
Write-Host "If you close this window, you'll need to run 'forge login' again." -ForegroundColor Red
Write-Host ""
