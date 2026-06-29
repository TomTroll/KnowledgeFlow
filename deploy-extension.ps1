# deploy-extension.ps1
# Schnell-Deploy: Chrome Extension bauen und in ein ladbares Verzeichnis kopieren.
# Ausführen: .\deploy-extension.ps1   (immer vom Workspace-Root / KnowledgeFlow-Ordner)

$ErrorActionPreference = "Stop"

# Immer relativ zum Skript-Verzeichnis arbeiten (= Workspace-Root)
$workspaceRoot  = $PSScriptRoot
$extDir         = Join-Path $workspaceRoot "packages\chrome-extension"
$destDir        = Join-Path $workspaceRoot "chrome-extension-dist"

Write-Host "🔨 Building Chrome Extension..." -ForegroundColor Cyan
Push-Location $extDir
node esbuild.config.mjs
Pop-Location

Write-Host "📦 Copying to $destDir..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $destDir -Force | Out-Null

# Built JS bundles
Copy-Item "$extDir\dist\background.js"  -Destination "$destDir\background.js"  -Force
Copy-Item "$extDir\dist\content.js"     -Destination "$destDir\content.js"      -Force
Copy-Item "$extDir\dist\popup.js"       -Destination "$destDir\popup.js"        -Force
Copy-Item "$extDir\dist\options.js"     -Destination "$destDir\options.js"      -Force

# Static files required by Chrome
Copy-Item "$extDir\manifest.json"       -Destination "$destDir\manifest.json"   -Force
Copy-Item "$extDir\popup.html"          -Destination "$destDir\popup.html"      -Force
Copy-Item "$extDir\options.html"        -Destination "$destDir\options.html"    -Force

Write-Host ""
Write-Host "✅ Done! To load the extension in Chrome:" -ForegroundColor Green
Write-Host "   1. Open chrome://extensions"
Write-Host "   2. Enable 'Developer mode' (top-right toggle)"
Write-Host "   3. Click 'Load unpacked'"
Write-Host "   4. Select this folder: $destDir"
Write-Host ""
Write-Host "   If already loaded: click the 🔄 reload button on the extension card."
