<#
.SYNOPSIS
  Testes E2E (Playwright + Chrome instalado) do MediaMind em ambiente isolado.

.DESCRIPTION
  1. Garante o PostgreSQL local do Docker (127.0.0.1:5433) e um banco SEPARADO
     "mediamind_e2e" com papel próprio "mediamind_e2e" (senha aleatória a cada execução).
     Nunca apaga nada: só cria o papel/banco se não existirem.
  2. Migra com Alembic e semeia duas empresas + dois usuários exclusivos desta execução
     (senha aleatória, passada só por variável de ambiente; nunca gravada em arquivo/log).
  3. Sobe a API (8020) e o Vite (5190, proxy /api -> 8020) ignorando o .env do checkout.
  4. Roda o Playwright e derruba somente os processos que este script iniciou.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/e2e.ps1 -Grep "timeline"
#>
param(
    [string]$Grep = '',
    [string]$BackendRoot = '',
    [switch]$Headed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendBase = if ($BackendRoot) { (Resolve-Path $BackendRoot).Path } else { $ProjectRoot }
$PythonExe = Join-Path $BackendBase '.venv/Scripts/python.exe'
$E2EDir = Join-Path $ProjectRoot 'tests/e2e'
$RuntimeDir = Join-Path $ProjectRoot '.runtime/e2e'
$ApiPort = 8020
$WebPort = 5190
$DbName = 'mediamind_e2e'
$DbRole = 'mediamind_e2e'

function New-RandomHex([int]$Bytes) {
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
    return -join ($buffer | ForEach-Object { $_.ToString('x2') })
}

function Assert-PortFree([int]$Port) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $listener.Start() }
    catch { throw "Porta $Port em uso. O E2E não encerra processos de terceiros; libere a porta." }
    finally { $listener.Stop() }
}

function Wait-Http([string]$Url, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch { Start-Sleep -Milliseconds 700 }
    }
    throw "Timeout aguardando $Url"
}

if (-not (Test-Path -LiteralPath $PythonExe)) { throw 'Crie o .venv do checkout (Python 3.12) antes do E2E.' }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'frontend/node_modules'))) {
    throw 'Rode "npx -y npm@11 ci" em frontend/ antes do E2E.'
}
if (-not (Test-Path -LiteralPath (Join-Path $E2EDir 'node_modules/@playwright/test'))) {
    Push-Location $E2EDir
    try { & npx.cmd -y npm@11 ci --no-audit --no-fund; if ($LASTEXITCODE) { throw 'npm ci (tests/e2e) falhou.' } }
    finally { Pop-Location }
}
Assert-PortFree $ApiPort
Assert-PortFree $WebPort

# --- 1. PostgreSQL local (Docker) e banco exclusivo do E2E ---------------------------------
$container = (& docker ps -a --filter 'label=com.docker.compose.project=hub-mediamind' `
        --filter 'label=com.docker.compose.service=postgres' --format '{{.Names}}' | Select-Object -First 1)
if (-not $container) { throw 'Container PostgreSQL do MediaMind não encontrado; rode scripts/setup.ps1 uma vez.' }
& docker start $container | Out-Null
$ready = $false
for ($i = 0; $i -lt 40 -and -not $ready; $i++) {
    & docker exec $container sh -c 'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    if ($LASTEXITCODE -eq 0) { $ready = $true } else { Start-Sleep -Milliseconds 750 }
}
if (-not $ready) { throw 'PostgreSQL não ficou pronto.' }

$dbPassword = New-RandomHex 24
# SQL enviado por stdin (não aparece em lista de processos). Somente CREATE/ALTER ROLE.
$setupSql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DbRole') THEN CREATE ROLE $DbRole LOGIN; END IF;
END `$`$;
ALTER ROLE $DbRole WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$dbPassword';
SELECT 'CREATE DATABASE $DbName OWNER $DbRole' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DbName')\gexec
"@
$setupSql | & docker exec -i $container sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | Out-Null
if ($LASTEXITCODE) { throw 'Falha ao preparar papel/banco E2E.' }
$setupSql = $null

# --- 2. Ambiente isolado (sem .env) -------------------------------------------------------
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
$runId = (Get-Date -Format 'yyyyMMddHHmmss') + (New-RandomHex 3)
$runDir = Join-Path $RuntimeDir $runId
New-Item -ItemType Directory -Force -Path (Join-Path $runDir 'media') | Out-Null

$saved = @{}
$envVars = @{
    ENVIRONMENT                     = 'test'
    DATABASE_URL                    = "postgresql+psycopg://${DbRole}:${dbPassword}@127.0.0.1:5433/$DbName"
    API_PORT                        = "$ApiPort"
    FRONTEND_PORT                   = "$WebPort"
    FRONTEND_URL                    = "http://127.0.0.1:$WebPort"
    GOOGLE_REDIRECT_URI             = "http://127.0.0.1:$ApiPort/api/v1/auth/google/callback"
    SESSION_COOKIE_SECURE           = 'false'
    LOGIN_MAX_ATTEMPTS              = '20'
    MEDIA_ROOT                      = (Join-Path $runDir 'media')
    MEDIAMIND_API_PROXY             = "http://127.0.0.1:$ApiPort"
    PYTHONPATH                      = (Join-Path $BackendBase 'backend')
    E2E_BACKEND_ROOT                = $BackendBase
    E2E_RUN_ID                      = $runId
    E2E_PASSWORD                    = (New-RandomHex 24)
    E2E_BASE_URL                    = "http://127.0.0.1:$WebPort"
    E2E_API_URL                     = "http://127.0.0.1:$ApiPort"
    E2E_RUN_DIR                     = $runDir
    E2E_ACCOUNTS_FILE               = (Join-Path $runDir 'accounts.json')
}
foreach ($key in $envVars.Keys) {
    $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $envVars[$key], 'Process')
}
$dbPassword = $null
$started = @()
$exitCode = 1
try {
    & $PythonExe (Join-Path $E2EDir 'no_dotenv.py') migrate
    if ($LASTEXITCODE) { throw 'Alembic upgrade falhou no banco E2E.' }
    $seedJson = & $PythonExe (Join-Path $E2EDir 'no_dotenv.py') seed
    if ($LASTEXITCODE) { throw 'Seed E2E falhou.' }
    # Somente e-mails e IDs das empresas de teste; nenhuma senha.
    $seedJson | Set-Content -LiteralPath $env:E2E_ACCOUNTS_FILE -Encoding utf8

    # --- 3. API e Vite nas portas E2E -----------------------------------------------------
    $api = Start-Process -FilePath $PythonExe -ArgumentList @((Join-Path $E2EDir 'no_dotenv.py'), 'api') `
        -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $runDir 'api.stdout.log') -RedirectStandardError (Join-Path $runDir 'api.stderr.log')
    $started += $api
    $node = (Get-Command node -ErrorAction Stop).Source
    Push-Location (Join-Path $ProjectRoot 'frontend')
    try { & $node scripts/prepare-person-segmentation.mjs | Out-Null } finally { Pop-Location }
    $web = Start-Process -FilePath $node -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', "$WebPort", '--strictPort') `
        -WorkingDirectory (Join-Path $ProjectRoot 'frontend') -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $runDir 'web.stdout.log') -RedirectStandardError (Join-Path $runDir 'web.stderr.log')
    $started += $web
    Wait-Http "http://127.0.0.1:$ApiPort/ready" 60
    Wait-Http "http://127.0.0.1:$WebPort/login" 90

    # --- 4. Playwright --------------------------------------------------------------------
    $pwArgs = @('node_modules/@playwright/test/cli.js', 'test')
    if ($Grep) { $pwArgs += @('--grep', $Grep) }
    if ($Headed) { $pwArgs += '--headed' }
    Push-Location $E2EDir
    try { & $node @pwArgs; $exitCode = $LASTEXITCODE } finally { Pop-Location }
    # Garantia: a senha da execução não pode aparecer em nenhum arquivo de texto gerado.
    $leaks = Get-ChildItem -LiteralPath $runDir -Recurse -File -Include *.log, *.json, *.md, *.txt, *.html |
        Select-String -SimpleMatch -Pattern $env:E2E_PASSWORD -List
    if ($leaks) { Write-Warning "Senha da execução encontrada em: $($leaks.Path -join ', ')"; $exitCode = 1 }
    Write-Host "Relatório: $(Join-Path $runDir 'report/index.html')"
    Write-Host "Evidências: $(Join-Path $runDir 'artifacts')"
} finally {
    foreach ($process in $started) {
        if ($process -and -not $process.HasExited) {
            # Encerra a árvore do processo iniciado por este script (e só ela).
            & taskkill.exe /PID $process.Id /T /F | Out-Null
        }
    }
    foreach ($key in $envVars.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') }
}
exit $exitCode
