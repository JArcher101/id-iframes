$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = "backup-before-bump-$timestamp"
New-Item -ItemType Directory -Path $backupDir | Out-Null

Get-ChildItem -Filter *.html | ForEach-Object {
    Copy-Item $_.FullName -Destination (Join-Path $backupDir $_.Name)
}

$fileCount = (Get-ChildItem $backupDir).Count
Write-Host "Backup created: $backupDir" -ForegroundColor Green
Write-Host "Files backed up: $fileCount" -ForegroundColor Cyan

