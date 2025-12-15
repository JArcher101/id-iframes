# Error Page Builder (PowerShell)
# Generates error pages for all error codes and bucket types
# 
# Usage: .\build-error-pages.ps1

# Error code configurations with causes
$errorConfigs = @{
    400 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'The request URL was malformed or invalid',
            'Missing required parameters in the request',
            'Invalid file format or encoding',
            'The request was rejected by the server'
        )
    }
    403 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'The URL has expired or the access token is invalid',
            'You do not have permission to access this resource',
            'The signed URL has been revoked',
            'Authentication credentials are missing or incorrect'
        )
    }
    404 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'The file has been moved or deleted',
            'The URL path is incorrect',
            'The file was never uploaded to the system',
            'The file may have been archived or removed'
        )
    }
    405 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'The HTTP method used is not allowed for this resource',
            'Only GET requests are supported for file access',
            'The request method is not permitted for this endpoint'
        )
    }
    414 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'The request URL is too long',
            'The URL exceeds the maximum allowed length',
            'Too many query parameters in the request'
        )
    }
    416 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'The requested byte range is not available',
            'The file size does not match the requested range',
            'Invalid range headers in the request'
        )
    }
    500 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'An internal server error occurred',
            'The server is temporarily unavailable',
            'A database or storage system error occurred',
            'Please try again in a few moments'
        )
    }
    501 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'This feature is not yet implemented',
            'The requested functionality is not available',
            'The server does not support this operation'
        )
    }
    502 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'The server received an invalid response from an upstream server',
            'A gateway or proxy server error occurred',
            'The service is temporarily unavailable',
            'Please try again in a few moments'
        )
    }
    504 = @{
        title = "We're sorry but an error occurred getting that {{TYPE}}"
        causes = @(
            'The request timed out waiting for a response',
            'The server took too long to process the request',
            'A timeout occurred while retrieving the file',
            'Please try again'
        )
    }
}

# System/Bucket configurations
$systemConfigs = @{
    'id-images' = @{
        name = 'ID Images CDN'
        isDocument = $false
        type = 'image'
    }
    'id-documents' = @{
        name = 'ID Documents CDN'
        isDocument = $true
        type = 'document'
    }
    'sdlt-documents' = @{
        name = 'SDLT Documents CDN'
        isDocument = $true
        type = 'document'
    }
}

# Footer text content
$footerTexts = @{
    'sdlt-documents' = @"
    <p class="footer-paragraph">
      This page is managed and owned by <a href="https://www.thurstanhoskin.co.uk" class="footer-link">Thurstan Hoskin Solicitors</a> on behalf of Dwellworks.
    </p>
    <p class="footer-paragraph">
      By accessing this page, you agree to our <a href="https://thurstanhoskin.co.uk/file-upload/log-in/?system=Dwellworks&terms=true" class="footer-link">Terms of Use</a> and <a href="https://thurstanhoskin.co.uk/privacy" class="footer-link">Privacy Policy</a>.
    </p>
"@
    'id-documents' = @"
    <p class="footer-paragraph">
      This page is managed and owned by <a href="https://www.thurstanhoskin.co.uk" class="footer-link">Thurstan Hoskin Solicitors</a>.
    </p>
"@
    'id-images' = @"
    <p class="footer-paragraph">
      This page is managed and owned by <a href="https://www.thurstanhoskin.co.uk" class="footer-link">Thurstan Hoskin Solicitors</a>.
    </p>
"@
}

# Read SVG icon files
function Read-SvgIcon {
    param([string]$IconName)
    $iconsDir = Join-Path $PSScriptRoot "icons"
    $iconPath = Join-Path $iconsDir "$IconName.svg"
    if (Test-Path $iconPath) {
        $svgContent = Get-Content $iconPath -Raw
        # Remove XML declaration and return just the SVG element
        $svgContent = $svgContent -replace '^\s*<\?xml[^>]*\?>\s*', ''
        return $svgContent.Trim()
    }
    return ""
}

# Read template files
function Read-Template {
    param([string]$Name)
    $templateDir = Join-Path $PSScriptRoot "templates"
    $templatePath = Join-Path $templateDir "$Name.html"
    return Get-Content $templatePath -Raw
}

# Build error page HTML
function Build-ErrorPage {
    param(
        [int]$ErrorCode,
        [string]$SystemKey
    )
    
    $config = $errorConfigs[$ErrorCode]
    $system = $systemConfigs[$SystemKey]
    
    # Determine SVG icon based on system type
    $iconSvg = if ($system.isDocument) { 
        Read-SvgIcon "document-icon"
    } else { 
        Read-SvgIcon "image-icon"
    }
    
    # Build causes list HTML
    $causesList = ($config.causes | ForEach-Object { "            <li>$_</li>" }) -join "`n"
    
    # Replace {{TYPE}} in title with "document" or "image"
    $errorTitle = $config.title -replace '\{\{TYPE\}\}', $system.type
    
    # Read CDN-specific template
    $template = Read-Template "$SystemKey-template"
    
    # Replace placeholders - need to handle ERROR_TITLE in title tag vs h1 separately
    $pageTitle = "$ErrorCode Error - $($system.name)"
    $html = $template `
        -replace '<title>\{\{ERROR_TITLE\}\}', "<title>$pageTitle" `
        -replace '\{\{ERROR_EMOJI\}\}', $iconSvg `
        -replace '<h1 class="error-title">\{\{ERROR_TITLE\}\}', "<h1 class=`"error-title`">$errorTitle" `
        -replace '\{\{ERROR_CODE\}\}', $ErrorCode.ToString() `
        -replace '\{\{ERROR_CAUSES\}\}', $causesList
    
    return $html
}

# Main build function
function Build-AllErrorPages {
    $outputBaseDir = Join-Path $PSScriptRoot "generated"
    
    # Create base output directory if it doesn't exist
    if (-not (Test-Path $outputBaseDir)) {
        New-Item -ItemType Directory -Path $outputBaseDir -Force | Out-Null
    }
    
    $errorCodes = $errorConfigs.Keys | Sort-Object
    $systemKeys = $systemConfigs.Keys
    
    Write-Host "[BUILD] Building error pages...`n" -ForegroundColor Cyan
    
    $totalCount = 0
    
    # Generate pages for each system type
    foreach ($systemKey in $systemKeys) {
        $systemDir = Join-Path $outputBaseDir $systemKey
        
        # Create system directory if it doesn't exist
        if (-not (Test-Path $systemDir)) {
            New-Item -ItemType Directory -Path $systemDir -Force | Out-Null
        }
        
        Write-Host "[DIR] Generating pages for $systemKey..." -ForegroundColor Yellow
        
        # Generate pages for each error code
        foreach ($errorCode in $errorCodes) {
            $html = Build-ErrorPage -ErrorCode $errorCode -SystemKey $systemKey
            $filename = "$errorCode.html"
            $filepath = Join-Path $systemDir $filename
            
            Set-Content -Path $filepath -Value $html -Encoding UTF8
            Write-Host "  [OK] $filename" -ForegroundColor Green
            $totalCount++
        }
        
        Write-Host ""
    }
    
    Write-Host "[SUCCESS] Generated $totalCount error pages" -ForegroundColor Green
    Write-Host "[INFO] Output directory: $outputBaseDir" -ForegroundColor Cyan
    Write-Host "`n[STRUCTURE] Directory structure:" -ForegroundColor Cyan
    foreach ($systemKey in $systemKeys) {
        Write-Host "   $systemKey/" -ForegroundColor Yellow
        foreach ($errorCode in $errorCodes) {
            Write-Host "     - $errorCode.html"
        }
    }
    Write-Host "`n[NEXT] Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Review the generated pages in your browser"
    Write-Host "   2. Test all error pages locally"
    Write-Host "   3. Upload to S3 using: scripts/sync-error-pages-to-s3.ps1"
}

# Run the build
Build-AllErrorPages

