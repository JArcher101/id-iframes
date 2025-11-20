Param(
    [string] $Title,
    [string] $Body = "",
    [switch] $Push,
    [switch] $NoGit,
    [switch] $SkipLog
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
Set-Location $repoRoot

if (-not $NoGit -and [string]::IsNullOrWhiteSpace($Title)) {
    throw "Commit title is required unless -NoGit is specified."
}

function New-ShortUuid {
    return ([guid]::NewGuid().ToString('N').Substring(0, 7)).ToLower()
}

function Read-Utf8File {
    param([string] $FilePath)
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    return $utf8NoBom.GetString($bytes)
}

function Write-Utf8File {
    param([string] $FilePath, [string] $Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $bytes = $utf8NoBom.GetBytes($Content)
    [System.IO.File]::WriteAllBytes($FilePath, $bytes)
}

function Update-AssetVersions {
    param(
        [string] $Content,
        [string] $Uuid
    )

    $pattern = '(?<attr>src|href)\s*=\s*(?<quote>"|'')(?<path>(?!(?:https?:|data:|mailto:|\/\/))[^"''\s>]+?\.(?:css|js))(?<query>\?[^"''\s>]*)?\k<quote>'

    $evaluator = {
        param($match, $uuid)
        $attr = $match.Groups['attr'].Value
        $quote = $match.Groups['quote'].Value
        $path = $match.Groups['path'].Value

        if ([string]::IsNullOrWhiteSpace($path)) {
            return $match.Value
        }

        return ('{0}={1}{2}?v={3}{1}' -f $attr, $quote, $path, $uuid)
    }

    return [System.Text.RegularExpressions.Regex]::Replace(
        $Content,
        $pattern,
        { param($m) $evaluator.Invoke($m, $Uuid) },
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
}

function Ensure-VersionBlock {
    param(
        [string] $Content,
        [string] $IframeName,
        [string] $Uuid
    )

    $startMarker = '<!-- IFRAME_VERSION START -->'
    $endMarker = '<!-- IFRAME_VERSION END -->'
    $block = @"
$startMarker
<script>
  (function() {
    window.__IFRAME_VERSION__ = '$Uuid';
    console.log('[$IframeName] version ' + window.__IFRAME_VERSION__);
  })();
</script>
$endMarker
"@

    $markerPattern = [System.Text.RegularExpressions.Regex]::Escape($startMarker) + '.*?' + [System.Text.RegularExpressions.Regex]::Escape($endMarker)

    if ([System.Text.RegularExpressions.Regex]::IsMatch($Content, $markerPattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)) {
        return [System.Text.RegularExpressions.Regex]::Replace(
            $Content,
            $markerPattern,
            $block,
            [System.Text.RegularExpressions.RegexOptions]::Singleline
        )
    }

    $bodyPattern = '</body\s*>'
    if ([System.Text.RegularExpressions.Regex]::IsMatch($Content, $bodyPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        return [System.Text.RegularExpressions.Regex]::Replace(
            $Content,
            $bodyPattern,
            "$block`r`n</body>",
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
    }

    return "$Content`r`n$block"
}

$uuid = New-ShortUuid
Write-Host "Using iframe version: $uuid"

$htmlFiles = Get-ChildItem -Path $repoRoot -Filter *.html -File
if (-not $htmlFiles) {
    throw "No HTML files found to update."
}

foreach ($file in $htmlFiles) {
    # Read using byte-level operations to preserve Unicode emojis
    $content = Read-Utf8File $file.FullName
    $updated = Update-AssetVersions -Content $content -Uuid $uuid
    $updated = Ensure-VersionBlock -Content $updated -IframeName $file.BaseName -Uuid $uuid
    if ($content -ne $updated) {
        # Write using byte-level operations to preserve Unicode emojis
        Write-Utf8File $file.FullName $updated
        Write-Host "Updated $($file.Name)"
    } else {
        Write-Host "No changes needed for $($file.Name)"
    }
}

if (-not $SkipLog) {
    $logJsonPath = Join-Path $repoRoot 'iframe-version-log.json'
    if (-not (Test-Path $logJsonPath)) {
        Write-Utf8File $logJsonPath '[]'
    }

    $rawJson = Read-Utf8File $logJsonPath
    $existingEntries = @()
    if (-not [string]::IsNullOrWhiteSpace($rawJson)) {
        try {
            $rawJson = $rawJson.Trim()  # Remove any trailing whitespace
            if ($rawJson -match '^\s*\[\s*\]\s*$') {
                # Empty array - no entries
                $existingEntries = @()
            } else {
                $converted = $rawJson | ConvertFrom-Json
                if ($converted -is [System.Collections.IEnumerable]) {
                    $existingEntries = @($converted)
                } elseif ($converted) {
                    $existingEntries = @($converted)
                }
            }
        } catch {
            Write-Host "Warning: Could not parse JSON log file, starting fresh." -ForegroundColor Yellow
            $existingEntries = @()
        }
    }

    $timestamp = (Get-Date).ToUniversalTime()
    $timestampIso = $timestamp.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $displayTimestamp = $timestamp.ToString("yyyy-MM-dd HH:mm:ss 'UTC'")
    $sortedIframes = $htmlFiles | Sort-Object Name | ForEach-Object { $_.Name }
    $commitTitleWithUuid = if ($Title) { "$Title [$uuid]" } else { "Manual run [$uuid]" }

    $entry = [ordered]@{
        timestampUtc = $timestampIso
        displayTime = $displayTimestamp
        uuid = $uuid
        title = $Title
        commitTitle = $commitTitleWithUuid
        commitBody = $Body
        pushed = [bool]$Push.IsPresent
        iframeCount = $sortedIframes.Count
        iframes = $sortedIframes
    }

    $updatedEntries = @($entry)
    if ($existingEntries) {
        $updatedEntries += $existingEntries
    }

    $jsonOutput = $updatedEntries | ConvertTo-Json -Depth 6
    Write-Utf8File $logJsonPath $jsonOutput
    Write-Host "Logged bump to iframe-version-log.json"
} else {
    Write-Host "Skipping log update."
}

if ($NoGit) {
    Write-Host "Skipping git commit/push."
    return
}

function Invoke-Git {
    param([string[]] $Arguments)
    git @Arguments | Write-Output
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed."
    }
}

Invoke-Git -Arguments @('add', '--all')
$commitTitle = "$Title [$uuid]"
$commitArgs = @('commit', '-m', $commitTitle)
if (-not [string]::IsNullOrWhiteSpace($Body)) {
    $commitArgs += @('-m', $Body)
}
Invoke-Git -Arguments $commitArgs

if ($Push) {
    Invoke-Git -Arguments @('push')
}

Write-Host "Done. Commit created with version $uuid."
