# Sync Error Pages to All S3 Buckets
# This script uploads error pages to all 6 S3 buckets used by CloudFront

param(
    [string]$ErrorPagesPath = "error-pages",
    [string]$S3Prefix = "protected/errors",  # Use "protected/errors" (no policy changes) or "error-pages" (requires policy update)
    [switch]$DryRun = $false
)

$buckets = @(
    "id-images-prod-london",
    "id-images-backup-frankfurt",
    "id-documents-prod-london",
    "id-documents-backup-frankfurt",
    "sdlt-documents-prod-london",
    "sdlt-documents-backup-frankfurt"
)

Write-Host "🔄 Syncing error pages to S3 buckets..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $ErrorPagesPath)) {
    Write-Host "❌ Error: Error pages directory not found: $ErrorPagesPath" -ForegroundColor Red
    Write-Host "   Make sure you're running this from the repo root." -ForegroundColor Yellow
    exit 1
}

$errorFiles = Get-ChildItem -Path $ErrorPagesPath -Filter "*.html"
if ($errorFiles.Count -eq 0) {
    Write-Host "❌ Error: No HTML files found in $ErrorPagesPath" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Found $($errorFiles.Count) error page files:" -ForegroundColor Green
foreach ($file in $errorFiles) {
    Write-Host "   - $($file.Name)" -ForegroundColor Gray
}
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN MODE - No files will be uploaded" -ForegroundColor Yellow
    Write-Host ""
}

foreach ($bucket in $buckets) {
    Write-Host "📦 Processing bucket: $bucket" -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Host "   [DRY RUN] Would sync to: s3://$bucket/$S3Prefix/" -ForegroundColor Gray
    } else {
        try {
            # Check if AWS CLI is available
            $awsCliCheck = Get-Command aws -ErrorAction SilentlyContinue
            if (-not $awsCliCheck) {
                Write-Host "❌ Error: AWS CLI not found. Please install AWS CLI first." -ForegroundColor Red
                Write-Host "   Download from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
                exit 1
            }
            
            # Sync error pages to bucket
            Write-Host "   Uploading to s3://$bucket/$S3Prefix/..." -ForegroundColor Gray
            aws s3 sync "$ErrorPagesPath" "s3://$bucket/$S3Prefix/" --exclude "*" --include "*.html" --quiet
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "   ✅ Successfully synced to $bucket" -ForegroundColor Green
            } else {
                Write-Host "   ❌ Failed to sync to $bucket (exit code: $LASTEXITCODE)" -ForegroundColor Red
            }
        } catch {
            Write-Host "   ❌ Error syncing to $bucket : $_" -ForegroundColor Red
        }
    }
    Write-Host ""
}

if (-not $DryRun) {
    Write-Host "✅ Sync complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Configure CloudFront error responses with path: /$S3Prefix/403.html" -ForegroundColor Gray
    Write-Host "   2. If using 'error-pages/', update bucket policy (see BUCKET-POLICY-ERROR-PAGES-UPDATE.md)" -ForegroundColor Gray
    Write-Host "   3. Test error pages by accessing a protected file without auth" -ForegroundColor Gray
    Write-Host "   4. If needed, invalidate CloudFront cache for error pages" -ForegroundColor Gray
} else {
    Write-Host "💡 Run without -DryRun to actually upload files" -ForegroundColor Yellow
}

