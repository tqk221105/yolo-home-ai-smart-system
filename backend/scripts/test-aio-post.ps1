# POST một điểm dữ liệu lên Adafruit IO (tránh lỗi escape JSON của curl trên PowerShell).
# Chạy từ thư mục backend:  .\scripts\test-aio-post.ps1
# Hoặc:  pwsh -File .\scripts\test-aio-post.ps1 -FeedKey fan-speed -Value "50"

param(
    [string] $FeedKey = "fan-speed",
    [string] $Value = "50"
)

$ErrorActionPreference = "Stop"
$backendDir = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $backendDir ".env"

if (-not (Test-Path $envPath)) {
    Write-Error "Khong tim thay .env tai: $envPath"
    exit 1
}

$user = $null
$key = $null
Get-Content -LiteralPath $envPath -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^\s*#' -or $line -eq "") { return }
    if ($line -match '^\s*ADAFRUIT_USERNAME\s*=\s*(.+)$') { $user = $Matches[1].Trim().Trim('"') }
    if ($line -match '^\s*ADAFRUIT_API_KEY\s*=\s*(.+)$') { $key = $Matches[1].Trim().Trim('"') }
}

if (-not $user -or -not $key) {
    Write-Error "Thieu ADAFRUIT_USERNAME hoac ADAFRUIT_API_KEY trong .env"
    exit 1
}

if ($key -match '^ADAFRUIT_API_KEY\s*=') { $key = ($key -split '=', 2)[-1].Trim() }
if ($key -match '^X-AIO-Key\s*:') { $key = ($key -split ':', 2)[-1].Trim() }

$uri = "https://io.adafruit.com/api/v2/$user/feeds/$FeedKey/data"
$headers = @{
    "X-AIO-Key"    = $key
    "Content-Type" = "application/json; charset=utf-8"
}
$body = (@{ value = $Value } | ConvertTo-Json -Compress)

try {
    $resp = Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $body -UseBasicParsing
    Write-Host "HTTP $($resp.StatusCode)"
    Write-Host $resp.Content
}
catch {
    $r = $_.Exception.Response
    if ($r) {
        $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
        $txt = $sr.ReadToEnd()
        Write-Host "HTTP $([int]$r.StatusCode)"
        Write-Host $txt
    }
    else {
        Write-Host $_
    }
    exit 1
}
