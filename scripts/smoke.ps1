# Smoke rapide HTTP sur l'API (backend doit tourner, ex. npm run dev dans backend).
# Usage : .\scripts\smoke.ps1
#         .\scripts\smoke.ps1 -BaseUrl "http://127.0.0.1:5000"
param(
    [string]$BaseUrl = "http://localhost:5000"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

$checks = @(
    @{ Method = "GET"; Path = "/api/health" }
    @{ Method = "GET"; Path = "/api/projects/public" }
)

Write-Host "Smoke test -> $BaseUrl"
foreach ($c in $checks) {
    $uri = "$BaseUrl$($c.Path)"
    try {
        $resp = Invoke-WebRequest -Uri $uri -Method $c.Method -UseBasicParsing -TimeoutSec 15
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
            Write-Host "[OK]   $($c.Method) $uri ($($resp.StatusCode))"
        }
        else {
            Write-Host "[FAIL] $($c.Method) $uri (status $($resp.StatusCode))"
            exit 1
        }
    }
    catch {
        Write-Host "[FAIL] $($c.Method) $uri :: $($_.Exception.Message)"
        exit 1
    }
}

Write-Host "Smoke test termine avec succes."
