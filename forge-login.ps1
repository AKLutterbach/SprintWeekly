# Forge Auto-Login Script
# This script stores your Forge credentials and handles login automatically

$credentialsPath = "$PSScriptRoot\.forge-credentials"

# Check if credentials file exists
if (Test-Path $credentialsPath) {
    Write-Host "Loading stored credentials..." -ForegroundColor Green
    $credentials = Get-Content $credentialsPath | ConvertFrom-Json
    $env:FORGE_EMAIL = $credentials.email
    $env:FORGE_API_TOKEN = $credentials.token
    Write-Host "Credentials loaded for $($credentials.email)" -ForegroundColor Green
} else {
    Write-Host "No stored credentials found. Please enter your Forge credentials:" -ForegroundColor Yellow
    $email = Read-Host "Enter your Atlassian email"
    $token = Read-Host "Enter your Atlassian API token" -AsSecureString
    
    # Convert SecureString to plain text for storage (in a local file only you can access)
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
    $plainToken = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    
    # Save credentials
    $credentials = @{
        email = $email
        token = $plainToken
    }
    $credentials | ConvertTo-Json | Set-Content $credentialsPath
    
    # Set environment variables
    $env:FORGE_EMAIL = $email
    $env:FORGE_API_TOKEN = $plainToken
    
    Write-Host "Credentials saved and loaded" -ForegroundColor Green
}

# Attempt Forge login
Write-Host "Logging in to Forge..." -ForegroundColor Cyan
forge login --non-interactive --email $env:FORGE_EMAIL --token $env:FORGE_API_TOKEN

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully logged in!" -ForegroundColor Green
} else {
    Write-Host "Login failed. Environment variables are set for commands to use." -ForegroundColor Yellow
}
