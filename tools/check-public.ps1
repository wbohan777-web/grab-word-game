$ErrorActionPreference = 'Continue'
$url = 'https://myspace-broadcast-solomon-breeds.trycloudflare.com'
foreach ($path in @('/healthz', '/api/config')) {
    try {
        $r = Invoke-WebRequest -Uri ($url + $path) -TimeoutSec 25 -UseBasicParsing
        Write-Output ('OK ' + $path + ' HTTP ' + $r.StatusCode)
        Write-Output $r.Content
    } catch {
        Write-Output ('FAIL ' + $path + ' : ' + $_.Exception.Message)
    }
}
