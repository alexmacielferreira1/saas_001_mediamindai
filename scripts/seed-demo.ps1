$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $python)) {
    throw 'Ambiente Python local não encontrado. Execute scripts/setup.ps1 primeiro.'
}

Push-Location $projectRoot
try {
    $previousPythonPath = $env:PYTHONPATH
    $env:PYTHONPATH = Join-Path $projectRoot 'backend'
    & $python 'scripts\seed_demo.py'
    if ($LASTEXITCODE -ne 0) { throw "Seed demo falhou com código $LASTEXITCODE." }
}
finally {
    $env:PYTHONPATH = $previousPythonPath
    Pop-Location
}
