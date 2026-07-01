# deploy-plugin.ps1
# Schnell-Deploy: Plugin bauen und direkt ins test-vault kopieren.
# Ausführen: .\deploy-plugin.ps1   (immer vom Workspace-Root)

$ErrorActionPreference = "Stop"

# Immer relativ zum Skript-Verzeichnis arbeiten (= Workspace-Root)
$workspaceRoot = $PSScriptRoot
$pluginDir     = Join-Path $workspaceRoot "packages\obsidian-plugin"
$destDir       = Join-Path $workspaceRoot "test-vault\.obsidian\plugins\knowledgeflow"

Write-Host "-> Building plugin..." -ForegroundColor Cyan
Push-Location $pluginDir
node esbuild.config.mjs
Pop-Location

Write-Host "-> Copying to test-vault..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $destDir -Force | Out-Null
Copy-Item "$pluginDir\dist\main.js"  -Destination "$destDir\main.js"  -Force
Copy-Item "$pluginDir\manifest.json" -Destination "$destDir\manifest.json" -Force
if (Test-Path "$pluginDir\styles.css") {
    Copy-Item "$pluginDir\styles.css" -Destination "$destDir\styles.css" -Force
}

Write-Host "[OK] Done! Reload the plugin in Obsidian:" -ForegroundColor Green
Write-Host "   Settings → Community plugins → KnowledgeFlow → Disable → Enable"
Write-Host ""
Write-Host "[Test] Test the HTTP server (nach Token-Generierung in Settings):"
Write-Host '   curl -H "Authorization: Bearer <dein-token>" http://127.0.0.1:37321/status'
