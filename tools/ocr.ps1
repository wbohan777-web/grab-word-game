$ErrorActionPreference = 'Stop'
$img = 'D:\电脑管家迁移文件\xwechat_files\wxid_g6uqkjxsb1je29_ed2d\temp\RWTemp\2026-11\919be637432313f73cc98cf35bab9fbd\1bd5e756c8d1f38317c7ae98c0ac759a.jpg'
$outFile = 'C:\Users\admin\.xkcode\.zcode\workspace\115ec9db-f413-4c27-b0a2-810b938d33f5\grab\tools\ocr-result.txt'

if (-not (Test-Path $img)) { 'IMG_NOT_FOUND' | Set-Content $outFile -Encoding UTF8; exit 1 }

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($img)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$langs = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
$lines = @('available OCR languages: ' + (($langs | ForEach-Object { $_.LanguageTag }) -join ', '))

$engine = $null
foreach ($tag in @('zh-Hans-CN', 'zh-Hans', 'zh-CN', 'en-US')) {
    try {
        $lang = New-Object Windows.Globalization.Language $tag
        $e = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
        if ($e) { $engine = $e; $lines += ('using language: ' + $tag); break }
    } catch {}
}
if (-not $engine) {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    $lines += 'using user profile language'
}

if (-not $engine) {
    $lines += 'NO_OCR_ENGINE'
} else {
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $lines += '--- OCR TEXT ---'
    foreach ($line in $result.Lines) { $lines += $line.Text }
}

$lines -join "`n" | Set-Content $outFile -Encoding UTF8
Write-Output 'done'
