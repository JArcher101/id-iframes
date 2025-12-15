# Fix trailing character after emoji in id-images files
$files = Get-ChildItem "error-pages\generated\id-images\*.html"
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    # Remove any character after the emoji HTML entity
    $content = $content -replace '(&#128444;&#65039;)[^\<]', '$1'
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
    Write-Host "Fixed: $($file.Name)"
}
Write-Host "Done! Fixed all id-images files"

