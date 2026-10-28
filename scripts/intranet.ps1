# Sobe o MediaMind para a rede interna (servidor da emissora).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/intranet.ps1 [-Build] [-Port 8080]
#
# - ENVIRONMENT=intranet: sem login demo nem rotas locais sem autenticação, em HTTP.
# - A própria API serve a tela compilada (frontend/dist): tela e API na mesma origem, então
#   qualquer computador da rede abre pelo IP ou nome deste servidor, sem CORS/CSRF por endereço.
# - AI_SECRET_KEY: se não estiver no .env, reaproveita a chave local já usada (.runtime/ai-secret.key),
#   para as conexões de IA cadastradas continuarem legíveis. O valor nunca é mostrado.
# Banco (Docker/PostgreSQL), MEDIA_ROOT, INGEST_SOURCE_ROOT, EXPORT_ROOT e OUTBOUND_ALLOWED_HOSTS
# continuam vindo do .env.
param(
    [switch]$Build,
    [int]$Port = 8080
)
. "$PSScriptRoot/common.ps1"
Assert-Python

$dist = Join-Path $ProjectRoot 'frontend/dist'
if ($Build -or -not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) {
    Write-Host 'Compilando a tela (npm run build)...'
    Push-Location (Join-Path $ProjectRoot 'frontend')
    try { Invoke-Native 'npm.cmd' @('run', 'build') } finally { Pop-Location }
}

$env:ENVIRONMENT = 'intranet'
$env:FRONTEND_DIST = $dist
# Rede interna sem HTTPS: cookie de sessão sem a marca Secure (senão o navegador não o guarda).
if (-not $env:SESSION_COOKIE_SECURE) { $env:SESSION_COOKIE_SECURE = 'false' }
if (-not $env:AI_SECRET_KEY) {
    $keyFile = Join-Path $RuntimeDir 'ai-secret.key'
    if (Test-Path -LiteralPath $keyFile) {
        $env:AI_SECRET_KEY = (Get-Content -LiteralPath $keyFile -Raw).Trim()
    }
}

$addresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress)
Write-Host ''
Write-Host "MediaMind na intranet, porta $Port. Nos outros computadores, abra:"
Write-Host "  http://$($env:COMPUTERNAME.ToLower()):$Port"
foreach ($address in $addresses) { Write-Host "  http://${address}:$Port" }
Write-Host ''
Write-Host 'Se os outros computadores não abrirem, libere a porta no Firewall do Windows'
Write-Host '(PowerShell como Administrador, uma vez só):'
Write-Host "  New-NetFirewallRule -DisplayName 'MediaMind intranet' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Domain,Private"
Write-Host ''

# Caminho absoluto: o script pode ser chamado de outra pasta (atalho, tarefa agendada).
Set-Location $ProjectRoot
Invoke-Native $PythonExe @('-m', 'uvicorn', 'app.main:app', '--app-dir', (Join-Path $ProjectRoot 'backend'), '--host', '0.0.0.0', '--port', "$Port", '--no-access-log')
