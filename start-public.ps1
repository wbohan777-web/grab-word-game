# Grab-Word Room - public launcher (ASCII-safe source; UTF-8 BOM written separately)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$port = 7777
$server = Join-Path $PSScriptRoot 'server.js'
$logDir = Join-Path $PSScriptRoot 'logs'
$tunOut = Join-Path $logDir 'tunnel.out.log'
$tunErr = Join-Path $logDir 'tunnel.err.log'

function Fail([string]$msg) {
    Write-Host ''
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

function Test-Local {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/healthz" -TimeoutSec 2 -UseBasicParsing
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host '        GRAB-WORD ROOM  /  public online' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

# 1. dependencies
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js not found. Install from https://nodejs.org/'
}

$cf = $null
foreach ($p in @(
    'C:\Program Files (x86)\cloudflared\cloudflared.exe',
    'C:\Program Files\cloudflared\cloudflared.exe',
    (Join-Path $PSScriptRoot 'cloudflared.exe'),
    (Join-Path $PSScriptRoot 'tools\cloudflared.exe')
)) { if (Test-Path $p) { $cf = $p; break } }
if (-not $cf) {
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd) { $cf = $cmd.Source }
}
if (-not $cf) {
    Fail 'cloudflared.exe not found. Run: winget install Cloudflare.cloudflared'
}
Write-Host '[1/4] environment OK' -ForegroundColor Green

# 2. local server
if (-not (Test-Local)) {
    Write-Host '[2/4] starting local server ...'
    Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    $ok = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 300
        if (Test-Local) { $ok = $true; break }
    }
    if (-not $ok) { Fail 'local server did not start; check server.js' }
} else {
    Write-Host '[2/4] local server already running'
}
Write-Host '      local server OK' -ForegroundColor Green

# 3. public tunnel
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Remove-Item $tunOut, $tunErr -Force -ErrorAction SilentlyContinue

Write-Host '[3/4] creating public address (5-15s) ...'
$cfProc = Start-Process -FilePath $cf `
    -ArgumentList @('tunnel', '--url', "http://127.0.0.1:$port", '--no-autoupdate') `
    -RedirectStandardOutput $tunOut -RedirectStandardError $tunErr `
    -WindowStyle Hidden -PassThru

$publicUrl = $null
for ($i = 0; $i -lt 140; $i++) {
    Start-Sleep -Milliseconds 500
    foreach ($f in @($tunErr, $tunOut)) {
        if (Test-Path $f) {
            $txt = Get-Content $f -Raw -ErrorAction SilentlyContinue
            if ($txt -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $publicUrl = $Matches[0]; break }
        }
    }
    if ($publicUrl) { break }
}

if (-not $publicUrl) {
    if ($cfProc -and -not $cfProc.HasExited) { try { $cfProc.Kill() } catch {} }
    if (Test-Path $tunErr) { Get-Content $tunErr -Tail 12 | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray } }
    Fail 'could not get a public address (network may block Cloudflare)'
}

# tell the local server the public URL so invite links use it
try {
    $cfg = @{ publicUrl = $publicUrl } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/config" -Method Post `
        -ContentType 'application/json' -Body $cfg -TimeoutSec 3 | Out-Null
} catch {}

# 4. copy + open
try { Set-Clipboard -Value $publicUrl } catch {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.Clipboard]::SetText($publicUrl)
    } catch {}
}

Write-Host '[4/4] public address ready' -ForegroundColor Green
Write-Host ''
Write-Host '========================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Copied to clipboard. Paste it into your group chat:' -ForegroundColor Yellow
Write-Host ''
Write-Host "      $publicUrl" -ForegroundColor White
Write-Host ''
Write-Host '  Then:' -ForegroundColor Gray
Write-Host '    1) the browser opens automatically' -ForegroundColor Gray
Write-Host '    2) type a name, click 1v1 or brawl' -ForegroundColor Gray
Write-Host '    3) on the room page click the share button,' -ForegroundColor Gray
Write-Host '       send THAT link - it already carries the room code' -ForegroundColor Gray
Write-Host ''
Write-Host '========================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Keep this window open. Closing it ends the room.' -ForegroundColor Red
Write-Host '  Press Ctrl+C to stop' -ForegroundColor DarkGray
Write-Host ''

Start-Process $publicUrl

try {
    while (-not $cfProc.HasExited) { Start-Sleep -Seconds 1 }
} finally {
    if ($cfProc -and -not $cfProc.HasExited) { try { $cfProc.Kill() } catch {} }
}
