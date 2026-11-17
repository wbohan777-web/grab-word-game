$ErrorActionPreference = 'Stop'
$root = 'C:\Users\admin\.xkcode\.zcode\workspace\115ec9db-f413-4c27-b0a2-810b938d33f5\grab'
Set-Location $root
New-Item -ItemType Directory -Force -Path 'logs' | Out-Null
Remove-Item 'logs\tunnel.err.log', 'logs\tunnel.out.log' -Force -ErrorAction SilentlyContinue

$cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
if (-not (Test-Path $cf)) { $cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source }
if (-not $cf) { Write-Output 'NO_CLOUDFLARED'; exit 1 }

$p = Start-Process -FilePath $cf `
    -ArgumentList @('tunnel', '--url', 'http://127.0.0.1:7777', '--no-autoupdate') `
    -RedirectStandardError 'logs\tunnel.err.log' `
    -RedirectStandardOutput 'logs\tunnel.out.log' `
    -WindowStyle Hidden -PassThru

Write-Output ('pid=' + $p.Id)

$url = $null
for ($i = 0; $i -lt 100; $i++) {
    Start-Sleep -Milliseconds 500
    foreach ($f in @('logs\tunnel.err.log', 'logs\tunnel.out.log')) {
        if (Test-Path $f) {
            $t = Get-Content $f -Raw -ErrorAction SilentlyContinue
            if ($t -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $url = $Matches[0]; break }
        }
    }
    if ($url) { break }
}

if (-not $url) { Write-Output 'NO_URL'; exit 1 }
Write-Output ('URL=' + $url)

try {
    $body = @{ publicUrl = $url } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri 'http://127.0.0.1:7777/api/config' -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 5 | Out-Null
    Write-Output 'INJECTED=ok'
} catch {
    Write-Output ('INJECT_FAIL=' + $_.Exception.Message)
}
