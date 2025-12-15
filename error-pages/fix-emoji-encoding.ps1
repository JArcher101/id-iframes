# Fix emoji encoding in all generated error pages
$errorCodes = @(400, 403, 404, 405, 414, 416, 500, 501, 502, 504)
$systems = @('id-documents', 'id-images', 'sdlt-documents')

$errorConfigs = @{
    400 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'The request URL was malformed or invalid',
            'Missing required parameters in the request',
            'Invalid file format or encoding',
            'The request was rejected by the server'
        )
    }
    403 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'The URL has expired or the access token is invalid',
            'You do not have permission to access this resource',
            'The signed URL has been revoked',
            'Authentication credentials are missing or incorrect'
        )
    }
    404 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'The file has been moved or deleted',
            'The URL path is incorrect',
            'The file was never uploaded to the system',
            'The file may have been archived or removed'
        )
    }
    405 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'The HTTP method used is not allowed for this resource',
            'Only GET requests are supported for file access',
            'The request method is not permitted for this endpoint'
        )
    }
    414 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'The request URL is too long',
            'The URL exceeds the maximum allowed length',
            'Too many query parameters in the request'
        )
    }
    416 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'The requested byte range is not available',
            'The file size does not match the requested range',
            'Invalid range headers in the request'
        )
    }
    500 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'An internal server error occurred',
            'The server is temporarily unavailable',
            'A database or storage system error occurred',
            'Please try again in a few moments'
        )
    }
    501 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'This feature is not yet implemented',
            'The requested functionality is not available',
            'The server does not support this operation'
        )
    }
    502 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'The server received an invalid response from an upstream server',
            'A gateway or proxy server error occurred',
            'The service is temporarily unavailable',
            'Please try again in a few moments'
        )
    }
    504 = @{
        emoji = '📄'
        title = "We're sorry but an error occurred getting that document/image"
        causes = @(
            'The request timed out waiting for a response',
            'The server took too long to process the request',
            'A timeout occurred while retrieving the file',
            'Please try again'
        )
    }
}

# Use HTML entities for emojis to avoid encoding issues
$imageEmoji = '&#128444;&#65039;'  # 🖼️
$docEmoji = '&#128196;'  # 📄

foreach ($system in $systems) {
    $templatePath = Join-Path $PSScriptRoot "templates\$system-template.html"
    if (-not (Test-Path $templatePath)) {
        Write-Host "Template not found: $templatePath"
        continue
    }
    
    $template = Get-Content $templatePath -Raw -Encoding UTF8
    $emoji = if ($system -eq 'id-images') { $imageEmoji } else { $docEmoji }
    
    foreach ($code in $errorCodes) {
        $config = $errorConfigs[$code]
        $causesHtml = ($config.causes | ForEach-Object { "<li>$_</li>" }) -join "`n            "
        
        $html = $template -replace '\{\{ERROR_EMOJI\}\}', $emoji `
                          -replace '\{\{ERROR_TITLE\}\}', $config.title `
                          -replace '\{\{ERROR_CODE\}\}', $code `
                          -replace '\{\{ERROR_CAUSES\}\}', $causesHtml
        
        $outputDir = Join-Path $PSScriptRoot "generated\$system"
        if (-not (Test-Path $outputDir)) {
            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        }
        
        $outputPath = Join-Path $PSScriptRoot "$outputDir\$code.html"
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($outputPath, $html, $utf8NoBom)
        Write-Host "Generated: $outputPath"
    }
}

Write-Host "`nDone! Regenerated all error pages with proper UTF-8 encoding."

