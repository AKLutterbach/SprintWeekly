# Forge Deploy Wrapper
# This script handles the TypeScript configuration juggling needed for Forge deployment

param(
    [string]$Environment = "development",
    [switch]$NoVerify,
    [switch]$Verbose
)

Write-Host "Preparing for Forge deployment..." -ForegroundColor Cyan

# Backup original tsconfig
if (Test-Path "tsconfig.json") {
    Copy-Item "tsconfig.json" "tsconfig.original.json" -Force
}

# Create standalone Forge tsconfig (no extends to avoid circular dependency)
$forgeConfig = @{
    compilerOptions = @{
        target = "ES2020"
        module = "CommonJS"
        lib = @("ES2020", "DOM")
        jsx = "react-jsx"
        rootDir = "src"
        outDir = "dist"
        allowJs = $true
        checkJs = $false
        noEmit = $false
        skipLibCheck = $true
        esModuleInterop = $true
        forceConsistentCasingInFileNames = $false
        strict = $false
        declaration = $false
        sourceMap = $false
    }
    include = @("src/**/*")
    exclude = @("node_modules", "dist", "**/*.test.ts", "__tests__")
}

$forgeConfig | ConvertTo-Json -Depth 10 | Set-Content "tsconfig.json" -Force
Write-Host "Created Forge-compatible tsconfig.json" -ForegroundColor Green

# Build the deploy command
$deployCmd = "forge deploy --environment $Environment --non-interactive"
if ($NoVerify) {
    $deployCmd += " --no-verify"
}
if ($Verbose) {
    $deployCmd += " --verbose"
}

Write-Host "Running: $deployCmd" -ForegroundColor Cyan

# Run deployment
try {
    Invoke-Expression $deployCmd
    $exitCode = $LASTEXITCODE
} finally {
    # Restore original tsconfig
    if (Test-Path "tsconfig.original.json") {
        Copy-Item "tsconfig.original.json" "tsconfig.json" -Force
        Remove-Item "tsconfig.original.json" -Force
        Write-Host "Restored original tsconfig.json" -ForegroundColor Yellow
    }
}

exit $exitCode
