# Forge CLI Diagnostics Script for Windows
# Collects authentication and configuration information to diagnose UserNotFoundError
# Safe to run - does not modify any settings

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Forge CLI Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Version Information
Write-Host "[1] Version Information" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
Write-Host "Node Version:" -NoNewline; node --version
Write-Host "NPM Version:" -NoNewline; npm --version
Write-Host "Forge CLI Version:" -NoNewline; forge --version 2>&1 | Select-String "forge" | Out-String
Write-Host ""

# 2. Current Session Environment Variables
Write-Host "[2] Current PowerShell Session Environment Variables" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
if ($env:FORGE_EMAIL) {
    Write-Host "FORGE_EMAIL: $env:FORGE_EMAIL"
} else {
    Write-Host "FORGE_EMAIL: [NOT SET]" -ForegroundColor Green
}

if ($env:FORGE_API_TOKEN) {
    $tokenLength = $env:FORGE_API_TOKEN.Length
    Write-Host "FORGE_API_TOKEN: [SET - $tokenLength characters] ****************" -ForegroundColor Red
} else {
    Write-Host "FORGE_API_TOKEN: [NOT SET]" -ForegroundColor Green
}
Write-Host ""

# 3. Persistent User Environment Variables (Registry)
Write-Host "[3] Persistent User Environment Variables (HKCU:\Environment)" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
try {
    $userEnv = Get-ItemProperty -Path "HKCU:\Environment" -ErrorAction SilentlyContinue
    
    if ($userEnv.FORGE_EMAIL) {
        Write-Host "FORGE_EMAIL (PERSISTENT): $($userEnv.FORGE_EMAIL)" -ForegroundColor Red
        Write-Host "  ^ WARNING: Persistent env var found - this overrides fresh logins!" -ForegroundColor Red
    } else {
        Write-Host "FORGE_EMAIL (PERSISTENT): [NOT SET]" -ForegroundColor Green
    }
    
    if ($userEnv.FORGE_API_TOKEN) {
        $tokenLength = $userEnv.FORGE_API_TOKEN.Length
        Write-Host "FORGE_API_TOKEN (PERSISTENT): [SET - $tokenLength characters] ****************" -ForegroundColor Red
        Write-Host "  ^ WARNING: Persistent env var found - this is likely the problem!" -ForegroundColor Red
    } else {
        Write-Host "FORGE_API_TOKEN (PERSISTENT): [NOT SET]" -ForegroundColor Green
    }
} catch {
    Write-Host "Could not read registry: $_" -ForegroundColor Red
}
Write-Host ""

# 4. Forge Configuration Files
Write-Host "[4] Forge Configuration Files" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray

# Check local repo
$localForgeFiles = @(
    ".forge-credentials",
    ".forge",
    ".forge-cache"
)

Write-Host "Local Repo ($PWD):" -ForegroundColor Gray
foreach ($file in $localForgeFiles) {
    if (Test-Path $file) {
        $fileInfo = Get-Item $file
        Write-Host "  [FOUND] $file (Modified: $($fileInfo.LastWriteTime))" -ForegroundColor Yellow
    } else {
        Write-Host "  [NOT FOUND] $file" -ForegroundColor Green
    }
}

# Check user profile
Write-Host ""
Write-Host "User Profile ($env:USERPROFILE):" -ForegroundColor Gray
$profileForgeFiles = @(
    "$env:USERPROFILE\.forge",
    "$env:USERPROFILE\.config\forge",
    "$env:APPDATA\forge",
    "$env:LOCALAPPDATA\forge"
)

foreach ($file in $profileForgeFiles) {
    if (Test-Path $file) {
        $fileInfo = Get-Item $file
        Write-Host "  [FOUND] $file (Modified: $($fileInfo.LastWriteTime))" -ForegroundColor Yellow
        
        # If it's a directory, list contents
        if ($fileInfo.PSIsContainer) {
            Get-ChildItem $file -Recurse -File | ForEach-Object {
                Write-Host "    - $($_.Name) (Modified: $($_.LastWriteTime))" -ForegroundColor Gray
            }
        }
    } else {
        Write-Host "  [NOT FOUND] $file" -ForegroundColor Green
    }
}
Write-Host ""

# 5. Forge Settings
Write-Host "[5] Forge Settings" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
forge settings list 2>&1
Write-Host ""

# 6. Forge Whoami (Verbose)
Write-Host "[6] Forge Whoami --verbose" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
forge whoami --verbose 2>&1
Write-Host ""

# 7. Network Test
Write-Host "[7] Network Connectivity Test" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "https://api.atlassian.com/graphql" -Method Head -TimeoutSec 5 -UseBasicParsing
    Write-Host "api.atlassian.com: REACHABLE (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "api.atlassian.com: UNREACHABLE or BLOCKED" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# 8. Windows Credential Manager Check
Write-Host "[8] Windows Credential Manager (Manual Check Required)" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
Write-Host "Run 'cmdkey /list' to see stored credentials." -ForegroundColor Gray
Write-Host "Look for entries containing 'atlassian' or 'forge'." -ForegroundColor Gray
Write-Host ""
cmdkey /list | Select-String -Pattern "atlassian|forge" -Context 0,2
Write-Host ""

# 9. App Manifest Check
Write-Host "[9] Forge App Manifest" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
if (Test-Path "manifest.yml") {
    $appId = Select-String -Path "manifest.yml" -Pattern "id:\s*(.+)" | ForEach-Object { $_.Matches.Groups[1].Value }
    Write-Host "App ID: $appId" -ForegroundColor Cyan
} else {
    Write-Host "manifest.yml not found in current directory" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostics Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Review the output above for any RED warnings" -ForegroundColor White
Write-Host "2. Check if persistent FORGE_* env vars are set (Section 3)" -ForegroundColor White
Write-Host "3. If issues found, run forge-hard-reset.ps1" -ForegroundColor White
Write-Host ""
