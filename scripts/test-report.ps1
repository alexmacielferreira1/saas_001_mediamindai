param([switch]$ValidateOnly, [switch]$Force)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$reportRoot = Join-Path $projectRoot 'test-results'
if ($ValidateOnly) {
    Write-Output "Reports: $reportRoot"
    exit 0
}
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
$summaryPath = Join-Path $reportRoot 'latest.json'
if (Test-Path -LiteralPath $summaryPath) {
    $previousRun = Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json
    if ($previousRun.state -eq 'running') {
        $activeRunner = $null
        if ($previousRun.PSObject.Properties.Name -contains 'process_id') {
            $activeRunner = Get-Process -Id $previousRun.process_id -ErrorAction SilentlyContinue
            if ($activeRunner -and $activeRunner.StartTime.ToUniversalTime().ToString('o') -ne $previousRun.process_started) { $activeRunner = $null }
        } else {
            $activeRunner = Get-CimInstance Win32_Process | Where-Object {
                $_.ProcessId -ne $PID -and $_.Name -eq 'powershell.exe' -and
                $_.CommandLine -match '-File\s+.*test-report\.ps1' -and
                $_.CommandLine -notmatch '-ValidateOnly'
            }
        }
        if ($activeRunner) {
            Write-Output 'Testes ainda ativos em segundo plano. Aguarde ou encerre a execucao anterior.'
            exit 0
        }
        $previousRun.state = 'interrupted'
        $previousRun | ConvertTo-Json | Set-Content -LiteralPath $summaryPath -Encoding utf8
        $previousRun | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $previousRun.directory 'summary.json') -Encoding utf8
        Write-Output 'Execucao anterior interrompida reconhecida. Registro liberado.'
    }
}
Push-Location $projectRoot
try {
    $files = @(git ls-files --cached --others --exclude-standard) | Sort-Object -Unique
    $snapshot = [ordered]@{}
    foreach ($file in $files) {
        if ($file -match '^(backend/|frontend/src/|frontend/public/|frontend/scripts/|frontend/(package.*json|vite.config.*|jsconfig.json)$|pyproject.toml$|scripts/test-report.ps1$)' -and (Test-Path -LiteralPath $file -PathType Leaf)) {
            $snapshot[$file] = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
        }
    }
} finally { Pop-Location }
$baselinePath = Join-Path $reportRoot 'last-tested-files.json'
$baseline = @{}
if (Test-Path -LiteralPath $baselinePath) {
    $saved = Get-Content -LiteralPath $baselinePath -Raw | ConvertFrom-Json
    foreach ($property in $saved.PSObject.Properties) { $baseline[$property.Name] = $property.Value }
}
$changes = @()
foreach ($file in $snapshot.Keys) {
    if (-not $baseline.ContainsKey($file)) { $changes += [ordered]@{ file = $file; change = 'added' } }
    elseif ($baseline[$file] -ne $snapshot[$file]) { $changes += [ordered]@{ file = $file; change = 'modified' } }
}
foreach ($file in $baseline.Keys) {
    if (-not $snapshot.Contains($file)) { $changes += [ordered]@{ file = $file; change = 'deleted' } }
}
if ($changes.Count -eq 0 -and -not $Force) {
    Write-Output 'Nenhuma alteração desde a última execução. Testes não repetidos.'
    exit 0
}
$runId = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$runRoot = Join-Path $reportRoot $runId
New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
$snapshot | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runRoot 'files-before.json') -Encoding utf8
@{ changes = $changes; forced = [bool]$Force } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runRoot 'changes.json') -Encoding utf8
$summary = [ordered]@{
    run = $runId; state = 'running'; started = (Get-Date).ToString('o')
    process_id = $PID; process_started = (Get-Process -Id $PID).StartTime.ToUniversalTime().ToString('o')
    directory = $runRoot; backend_exit = $null; frontend_exit = $null
    backend_quality_exit = $null; frontend_quality_exit = $null
}
$summary | ConvertTo-Json | Set-Content -LiteralPath $summaryPath -Encoding utf8
Push-Location $projectRoot
try {
    $ErrorActionPreference = 'Continue'
    & {
        '=== BACKEND ==='
        & (Join-Path $projectRoot '.venv\Scripts\python.exe') -m pytest backend/tests -vv --cov=backend/app --cov-context=test --cov-report=term-missing "--cov-report=html:$runRoot/backend-html" "--cov-report=json:$runRoot/backend-coverage.json"
        $script:backendResult = $LASTEXITCODE
        '=== BACKEND: QUALIDADE E INTEGRIDADE ==='
        & (Join-Path $projectRoot '.venv\Scripts\python.exe') -m ruff check backend
        $script:backendQuality = $LASTEXITCODE
        & (Join-Path $projectRoot '.venv\Scripts\python.exe') -m ruff format --check backend
        if ($LASTEXITCODE -ne 0) { $script:backendQuality = $LASTEXITCODE }
        '=== FRONTEND ==='
        Push-Location (Join-Path $projectRoot 'frontend')
        try {
            & npm.cmd run test:coverage -- "--coverage.reportsDirectory=$runRoot/frontend-coverage"
            $script:frontendResult = $LASTEXITCODE
            '=== FRONTEND: QUALIDADE, TIPOS E BUILD ==='
            & npm.cmd run lint
            $script:frontendQuality = $LASTEXITCODE
            & npm.cmd run typecheck
            if ($LASTEXITCODE -ne 0) { $script:frontendQuality = $LASTEXITCODE }
            & npm.cmd run build
            if ($LASTEXITCODE -ne 0) { $script:frontendQuality = $LASTEXITCODE }
        } finally { Pop-Location }
        '=== SUMMARY ==='
        "Backend exit: $script:backendResult"
        "Frontend exit: $script:frontendResult"
        "Backend quality exit: $script:backendQuality"
        "Frontend quality exit: $script:frontendQuality"
    } *>&1 | Tee-Object -FilePath (Join-Path $runRoot 'report.txt')
    $summary.backend_exit = $script:backendResult
    $summary.frontend_exit = $script:frontendResult
    $summary.backend_quality_exit = $script:backendQuality
    $summary.frontend_quality_exit = $script:frontendQuality
    $summary.state = 'completed'
    $summary.finished = (Get-Date).ToString('o')
    # Save the pre-run snapshot: edits made during tests must trigger the next run.
    $snapshot | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $baselinePath -Encoding utf8
} finally {
    Pop-Location
    if ($summary.state -eq 'running') { $summary.state = 'interrupted' }
    $summary | ConvertTo-Json | Set-Content -LiteralPath $summaryPath -Encoding utf8
    $summary | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runRoot 'summary.json') -Encoding utf8
}
if ($script:backendResult -ne 0 -or $script:frontendResult -ne 0 -or $script:backendQuality -ne 0 -or $script:frontendQuality -ne 0) { exit 1 }
