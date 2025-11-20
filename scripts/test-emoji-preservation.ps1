# Test script to verify emoji preservation in bump-iframes.ps1
# 1. Creates a test HTML file with emojis
# 2. Runs the actual bump script on it (with -NoGit)
# 3. Keeps the file so you can open it and visually verify emojis are preserved

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
Set-Location $repoRoot

$testFile = Join-Path $repoRoot 'test-emoji-preservation.html'

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Emoji Preservation Test" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Use same UTF-8 encoding method as bump script
function Write-Utf8File {
    param([string] $FilePath, [string] $Content)
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    $bytes = $utf8NoBom.GetBytes($Content)
    [System.IO.File]::WriteAllBytes($FilePath, $bytes)
}

# Step 1: Create test file with emojis
$testContent = @'
<!DOCTYPE html>
<html>
<head>
  <title>Emoji Test</title>
</head>
<body>
  <h1>Emoji Preservation Test</h1>
  
  <script>
    console.log('🚀 Test emoji 1');
    console.log('📥 Test emoji 2');
    console.log('✅ Test emoji 3');
    console.log('🔍 Test emoji 4');
    console.log('📄 Test emoji 5');
    console.log('❌ Test emoji 6');
    
    // Test in template strings
    const msg = `✅ Found ${count} items`;
    
    // Test in comments
    // 🚀 This is a rocket emoji
  </script>
  
  <!-- IFRAME_VERSION START -->
  <script>
    (function() {
      window.__IFRAME_VERSION__ = 'test123';
      console.log('[test-emoji-preservation] version ' + window.__IFRAME_VERSION__);
    })();
  </script>
  <!-- IFRAME_VERSION END -->
</body>
</html>
'@

# Write using same byte-level method as bump script
Write-Utf8File $testFile $testContent
Write-Host "[STEP 1] Created test file with emojis" -ForegroundColor Green
Write-Host "   File: $testFile" -ForegroundColor Gray
Write-Host ""

# Step 2: Run the actual bump script on the test file
Write-Host "[STEP 2] Running bump script on test file..." -ForegroundColor Cyan
Write-Host "   Command: bump-iframes.ps1 -NoGit -SkipLog" -ForegroundColor Gray
Write-Host ""
& "$scriptRoot\bump-iframes.ps1" -Title "Test emoji preservation" -NoGit -SkipLog
Write-Host ""

# Step 3: Report results
Write-Host "[STEP 3] Bump script completed!" -ForegroundColor Green
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "MANUAL VERIFICATION REQUIRED" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "Open this file in your editor to check if emojis are preserved:" -ForegroundColor White
Write-Host "   $testFile" -ForegroundColor Yellow
Write-Host ""
Write-Host "Look for these emojis in the file:" -ForegroundColor White
Write-Host "   🚀 📥 ✅ 🔍 📄 ❌" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you see HTML entities like &#xE2;&#x153;&#x2026; instead of emojis," -ForegroundColor White
Write-Host "then the script is normalizing them (BAD)." -ForegroundColor Red
Write-Host ""
Write-Host "If you see actual emoji characters, the script is working correctly (GOOD)." -ForegroundColor Green
Write-Host ""

