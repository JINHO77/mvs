$patterns = @('*.ts', '*.tsx')
$targets = @('src/app', 'src/components', 'src/lib')
$results = New-Object System.Collections.Generic.List[string]

foreach ($target in $targets) {
  if (-not (Test-Path $target)) { continue }
  $files = Get-ChildItem -Path $target -Recurse -File -Include $patterns
  foreach ($file in $files) {
    if ($file.FullName -like '*\src\constants\*') { continue }
    $lineNo = 0
    Get-Content -LiteralPath $file.FullName | ForEach-Object {
      $lineNo++
      if ($_ -match '[가-힣]') {
        [void]$results.Add(("{0}:{1}: {2}" -f $file.FullName.Replace((Get-Location).Path + '\\', ''), $lineNo, $_.Trim()))
      }
    }
  }
}

if ($results.Count -eq 0) {
  Write-Output 'No Korean literals found outside src/constants.'
  exit 0
}

Write-Output 'Korean literals found outside src/constants:'
$results | ForEach-Object { Write-Output $_ }
exit 0
