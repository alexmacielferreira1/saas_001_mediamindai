param([Parameter(Mandatory=$true)][string]$Projeto)
$ErrorActionPreference = "Stop"
$source = Join-Path $PSScriptRoot "frontend"
$target = (Resolve-Path $Projeto).Path
if (!(Test-Path (Join-Path $target "backend/app/main.py"))) { throw "Destino incorreto: escolha a raiz do MediaMindAI, que contém backend e frontend." }
if (!(Test-Path (Join-Path $source "src/main.jsx"))) { throw "Extraia o ZIP completo antes de executar o instalador." }
$backup = Join-Path (Split-Path $target -Parent) ("mediamindai-backup-frontend-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$files = Get-ChildItem -Path $source -Recurse -File
foreach ($file in $files) {
  $relative = $file.FullName.Substring($source.Length).TrimStart([char[]]"\/")
  $destination = Join-Path (Join-Path $target "frontend") $relative
  if (Test-Path $destination) {
    $copy = Join-Path $backup $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $copy -Parent) | Out-Null
    Copy-Item -LiteralPath $destination -Destination $copy -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
}
Write-Host "Frontend completo copiado: $($files.Count) arquivos."
Write-Host "Backup dos arquivos anteriores: $backup"
Write-Host "Agora execute npm ci, npm test, npm run lint e npm run build dentro de frontend; depois commit e push."
