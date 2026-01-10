# Merge Changes from Sprint-Weekly-Test Script
# Safely compares and merges changes FROM test folder TO production folder

$ErrorActionPreference = "Stop"

# Configuration
$testRepo = "C:\Users\aklut\Documents\JiraBuild\Sprint-Weekly-Test"
$prodRepo = "C:\Users\aklut\Documents\JiraBuild\Sprint-Weekly"
$backupFolder = "$prodRepo\backup-before-merge-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Merge from Sprint-Weekly-Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Safety checks
if (-not (Test-Path $testRepo)) {
    Write-Host "ERROR: Test folder not found at $testRepo" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $prodRepo)) {
    Write-Host "ERROR: Production folder not found at $prodRepo" -ForegroundColor Red
    exit 1
}

Write-Host "This script will:" -ForegroundColor Yellow
Write-Host "  1. Create a backup of current production code" -ForegroundColor White
Write-Host "  2. Show you what files have changed in test folder" -ForegroundColor White
Write-Host "  3. Let you select which changes to merge" -ForegroundColor White
Write-Host ""
Write-Host "Locations:" -ForegroundColor Yellow
Write-Host "  FROM: $testRepo" -ForegroundColor White
Write-Host "  TO:   $prodRepo" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Type 'MERGE' to continue, or anything else to cancel"
if ($confirmation -ne "MERGE") {
    Write-Host "Cancelled." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Step 1: Creating backup..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null

# Backup critical files
$filesToBackup = @(
    "src/**/*.*",
    "manifest.yml",
    "package.json",
    "package-lock.json"
)

foreach ($pattern in $filesToBackup) {
    $files = Get-ChildItem -Path $prodRepo -Filter $pattern.Replace("**/*.", "*.")  -Recurse -File -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($prodRepo.Length + 1)
        $backupPath = Join-Path $backupFolder $relativePath
        $backupDir = Split-Path $backupPath -Parent
        if (-not (Test-Path $backupDir)) {
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        }
        Copy-Item $file.FullName $backupPath -Force
    }
}

Write-Host "  Backup created at: $backupFolder" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Comparing files..." -ForegroundColor Yellow
Write-Host ""

# Files to compare (excluding node_modules, build artifacts, etc.)
$srcFiles = Get-ChildItem -Path "$testRepo\src" -Recurse -File -ErrorAction SilentlyContinue
$manifestTest = "$testRepo\manifest.yml"
$manifestProd = "$prodRepo\manifest.yml"

$changedFiles = @()

# Compare src files
foreach ($testFile in $srcFiles) {
    $relativePath = $testFile.FullName.Substring($testRepo.Length + 1)
    $prodFile = Join-Path $prodRepo $relativePath
    
    if (-not (Test-Path $prodFile)) {
        Write-Host "  [NEW] $relativePath" -ForegroundColor Green
        $changedFiles += @{
            Type = "NEW"
            Path = $relativePath
            TestPath = $testFile.FullName
            ProdPath = $prodFile
        }
    } else {
        $testHash = (Get-FileHash $testFile.FullName).Hash
        $prodHash = (Get-FileHash $prodFile).Hash
        
        if ($testHash -ne $prodHash) {
            Write-Host "  [MODIFIED] $relativePath" -ForegroundColor Yellow
            $changedFiles += @{
                Type = "MODIFIED"
                Path = $relativePath
                TestPath = $testFile.FullName
                ProdPath = $prodFile
            }
        }
    }
}

# Compare manifest (excluding app ID)
if (Test-Path $manifestTest) {
    $testContent = Get-Content $manifestTest -Raw
    $prodContent = Get-Content $manifestProd -Raw
    
    # Remove app ID lines for comparison
    $testContentNoId = ($testContent -split "`n" | Where-Object { $_ -notmatch "^app:" }) -join "`n"
    $prodContentNoId = ($prodContent -split "`n" | Where-Object { $_ -notmatch "^app:" }) -join "`n"
    
    if ($testContentNoId -ne $prodContentNoId) {
        Write-Host "  [MODIFIED] manifest.yml (excluding app ID)" -ForegroundColor Yellow
        $changedFiles += @{
            Type = "MANIFEST"
            Path = "manifest.yml"
            TestPath = $manifestTest
            ProdPath = $manifestProd
        }
    }
}

Write-Host ""
Write-Host "Found $($changedFiles.Count) changed file(s)" -ForegroundColor Cyan
Write-Host ""

if ($changedFiles.Count -eq 0) {
    Write-Host "No changes to merge. Test and production are in sync!" -ForegroundColor Green
    exit 0
}

Write-Host "Step 3: Merge options" -ForegroundColor Yellow
Write-Host "  1 - Merge ALL changes" -ForegroundColor White
Write-Host "  2 - Review each file individually" -ForegroundColor White
Write-Host "  3 - Cancel" -ForegroundColor White
Write-Host ""
$mergeChoice = Read-Host "Your choice (1-3)"

switch ($mergeChoice) {
    "1" {
        Write-Host ""
        Write-Host "Merging all changes..." -ForegroundColor Yellow
        foreach ($file in $changedFiles) {
            if ($file.Type -eq "MANIFEST") {
                # Special handling for manifest - preserve prod app ID
                $testLines = Get-Content $file.TestPath
                $prodLines = Get-Content $file.ProdPath
                $prodAppId = ($prodLines | Where-Object { $_ -match "^app:" })[0]
                
                $mergedContent = @()
                $foundAppId = $false
                foreach ($line in $testLines) {
                    if ($line -match "^app:" -and -not $foundAppId) {
                        $mergedContent += $prodAppId
                        $foundAppId = $true
                    } elseif ($line -notmatch "^app:") {
                        $mergedContent += $line
                    }
                }
                
                $mergedContent | Set-Content $file.ProdPath
                Write-Host "  ✓ Merged $($file.Path) (preserved app ID)" -ForegroundColor Green
            } else {
                # For other files, just copy
                $prodDir = Split-Path $file.ProdPath -Parent
                if (-not (Test-Path $prodDir)) {
                    New-Item -ItemType Directory -Path $prodDir -Force | Out-Null
                }
                Copy-Item $file.TestPath $file.ProdPath -Force
                Write-Host "  ✓ Merged $($file.Path)" -ForegroundColor Green
            }
        }
        Write-Host ""
        Write-Host "All changes merged successfully!" -ForegroundColor Green
    }
    "2" {
        Write-Host ""
        Write-Host "Individual file review:" -ForegroundColor Yellow
        foreach ($file in $changedFiles) {
            Write-Host ""
            Write-Host "File: $($file.Path)" -ForegroundColor Cyan
            Write-Host "Type: $($file.Type)" -ForegroundColor White
            $merge = Read-Host "Merge this file? (Y/N)"
            if ($merge -eq "Y" -or $merge -eq "y") {
                if ($file.Type -eq "MANIFEST") {
                    # Special handling for manifest
                    $testLines = Get-Content $file.TestPath
                    $prodLines = Get-Content $file.ProdPath
                    $prodAppId = ($prodLines | Where-Object { $_ -match "^app:" })[0]
                    
                    $mergedContent = @()
                    $foundAppId = $false
                    foreach ($line in $testLines) {
                        if ($line -match "^app:" -and -not $foundAppId) {
                            $mergedContent += $prodAppId
                            $foundAppId = $true
                        } elseif ($line -notmatch "^app:") {
                            $mergedContent += $line
                        }
                    }
                    
                    $mergedContent | Set-Content $file.ProdPath
                    Write-Host "  ✓ Merged (preserved app ID)" -ForegroundColor Green
                } else {
                    $prodDir = Split-Path $file.ProdPath -Parent
                    if (-not (Test-Path $prodDir)) {
                        New-Item -ItemType Directory -Path $prodDir -Force | Out-Null
                    }
                    Copy-Item $file.TestPath $file.ProdPath -Force
                    Write-Host "  ✓ Merged" -ForegroundColor Green
                }
            } else {
                Write-Host "  ⊗ Skipped" -ForegroundColor Gray
            }
        }
    }
    default {
        Write-Host "Merge cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Merge Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backup location: $backupFolder" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run 'npm install' to update dependencies" -ForegroundColor White
Write-Host "  2. Run 'forge lint' to validate changes" -ForegroundColor White
Write-Host "  3. Test locally with 'forge tunnel'" -ForegroundColor White
Write-Host "  4. Deploy with 'forge deploy'" -ForegroundColor White
Write-Host ""
