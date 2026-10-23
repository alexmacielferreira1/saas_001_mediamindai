<#
.SYNOPSIS
  Aplica o kit de qualidade e segurança do HUB a um projeto SaaS.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File aplicar-kit-qualidade.ps1 -Projeto "C:\Users\Alex\Desktop\HUB\saas_002_novo"
.NOTES
  Não apaga nada. Arquivos já existentes no projeto são preservados (use -Atualizar para
  substituir as skills do kit por versões novas). Não faz commit nem push.
#>
param(
  [Parameter(Mandatory = $true)][string]$Projeto,
  [switch]$Atualizar
)
$ErrorActionPreference = 'Stop'
$Kit = $PSScriptRoot
# Fonte de skills/settings/roteiro: a própria pasta do kit (zip) ou, quando o kit está guardado
# em docs/qualidade/kit-hub de um SaaS, a raiz desse repositório.
$Fonte = $Kit
if (-not (Test-Path -LiteralPath (Join-Path $Kit '.claude\skills'))) {
  $Fonte = (Resolve-Path -LiteralPath (Join-Path $Kit '..\..\..')).Path
}
if (-not (Test-Path -LiteralPath $Projeto -PathType Container)) { throw "Pasta do projeto não encontrada: $Projeto" }

# 1. Skills
$destSkills = Join-Path $Projeto '.claude\skills'
New-Item -ItemType Directory -Force -Path $destSkills | Out-Null
Get-ChildItem -LiteralPath (Join-Path $Fonte '.claude\skills') -Directory | ForEach-Object {
  $alvo = Join-Path $destSkills $_.Name
  if ((Test-Path -LiteralPath $alvo) -and -not $Atualizar) {
    Write-Host "  = skill já existe, mantida: $($_.Name)"
  } else {
    Copy-Item -LiteralPath $_.FullName -Destination $destSkills -Recurse -Force
    Write-Host "  + skill: $($_.Name)"
  }
}

# 2. settings.json (plugins de segurança)
$destSettings = Join-Path $Projeto '.claude\settings.json'
if (Test-Path -LiteralPath $destSettings) {
  Write-Warning ".claude\settings.json já existe; mescle manualmente com $Fonte\.claude\settings.json"
} else {
  Copy-Item -LiteralPath (Join-Path $Fonte '.claude\settings.json') -Destination $destSettings
  Write-Host "  + .claude\settings.json"
}

# 3. Roteiro de revisão
$destDocs = Join-Path $Projeto 'docs'
New-Item -ItemType Directory -Force -Path $destDocs | Out-Null
$destRoteiro = Join-Path $destDocs 'REVISAO_QUALIDADE.md'
if ((Test-Path -LiteralPath $destRoteiro) -and -not $Atualizar) {
  Write-Host "  = docs\REVISAO_QUALIDADE.md já existe, mantido"
} else {
  Copy-Item -LiteralPath (Join-Path $Fonte 'docs\REVISAO_QUALIDADE.md') -Destination $destRoteiro -Force
  Write-Host "  + docs\REVISAO_QUALIDADE.md"
}

# 4. Seção no AGENTS.md
$agents = Join-Path $Projeto 'AGENTS.md'
$secao = Get-Content -LiteralPath (Join-Path $Kit 'AGENTS_SECAO.md') -Raw -Encoding UTF8
if (-not (Test-Path -LiteralPath $agents)) {
  Set-Content -LiteralPath $agents -Value ("# Instruções do projeto`n" + $secao) -Encoding UTF8
  Write-Host "  + AGENTS.md criado"
} elseif ((Get-Content -LiteralPath $agents -Raw -Encoding UTF8) -match 'Revisão de qualidade e segurança') {
  Write-Host "  = AGENTS.md já tem a seção"
} else {
  Add-Content -LiteralPath $agents -Value $secao -Encoding UTF8
  Write-Host "  + seção adicionada ao AGENTS.md"
}

# 5. CLAUDE.md (o Claude Code não lê AGENTS.md sozinho) e .ignore (buscas mais enxutas)
foreach ($nome in @('CLAUDE.md', '.ignore')) {
  $destino = Join-Path $Projeto $nome
  if (Test-Path -LiteralPath $destino) {
    Write-Host "  = $nome já existe, mantido"
  } else {
    Copy-Item -LiteralPath (Join-Path $Kit "modelos\$nome") -Destination $destino
    Write-Host "  + $nome"
  }
}

Write-Host "`nPronto. Revise com 'git status' e faça o commit quando quiser."
Write-Host "Permissões e hooks do Claude Code: veja a pasta proposta-config-claude (aprovação manual)."
