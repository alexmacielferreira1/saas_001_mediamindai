Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PythonExe = Join-Path $ProjectRoot '.venv/Scripts/python.exe'
$RuntimeDir = Join-Path $ProjectRoot '.runtime'

function Invoke-Native {
    param([string]$Exe, [string[]]$Arguments)
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Exe failed (exit $LASTEXITCODE)." }
}

function Invoke-AppPython {
    param([string[]]$Arguments)
    $previousPythonPath = $env:PYTHONPATH
    try {
        $env:PYTHONPATH = Join-Path $ProjectRoot 'backend'
        Invoke-Native $PythonExe $Arguments
    } finally {
        $env:PYTHONPATH = $previousPythonPath
    }
}

function Assert-Python {
    if (-not (Test-Path -LiteralPath $PythonExe)) { throw 'Run scripts/setup.ps1 first.' }
}

function Get-LocalConfig {
    Assert-Python
    $previousPythonPath = $env:PYTHONPATH
    try {
        $env:PYTHONPATH = Join-Path $ProjectRoot 'backend'
        $result = & $PythonExe -c 'import json; from app.core.config import get_settings; s=get_settings(); print(json.dumps(dict(service=s.app_name,api_port=s.api_port,frontend_port=s.frontend_port)))'
        if ($LASTEXITCODE -ne 0) { throw 'Could not read local settings.' }
    } finally {
        $env:PYTHONPATH = $previousPythonPath
    }
    return $result | ConvertFrom-Json
}

function Assert-PortFree {
    param([int]$Port)
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    try { $listener.Start() }
    catch { throw "Port $Port is in use. Change this project's .env; do not stop unrelated services." }
    finally { $listener.Stop() }
}

function Get-OwnedProcess {
    param($Record)
    $process = Get-Process -Id $Record.process_id -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $null }
    if (($process.StartTime.ToUniversalTime().Ticks.ToString() -ne $Record.start_ticks) -or
        ($Record.executable -and $process.Path -ne $Record.executable)) {
        throw 'PID belongs to another process; refusing to stop or reuse it.'
    }
    return $process
}

function Start-OwnedService {
    param([string]$Name, [string]$Exe, [string[]]$Arguments, [string]$Directory, [int]$Port)
    New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
    $stateFile = Join-Path $RuntimeDir "$Name.json"
    if (Test-Path -LiteralPath $stateFile) {
        $record = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        $existing = Get-OwnedProcess $record
        if ($null -ne $existing) {
            if ($record.port -ne $Port) { throw 'Port changed. Stop the existing service before restarting.' }
            Write-Host "$Name already running on port $Port."
            return
        }
    }
    Assert-PortFree $Port
    $process = Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $Directory `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $RuntimeDir "$Name.stdout.log") `
        -RedirectStandardError (Join-Path $RuntimeDir "$Name.stderr.log")
    $record = @{
        process_id = $process.Id
        start_ticks = $process.StartTime.ToUniversalTime().Ticks.ToString()
        executable = (Get-Command $Exe -ErrorAction Stop).Source
        port = $Port
    }
    $record | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8
    $url = "http://127.0.0.1:$Port/"
    if ($Name -eq 'backend') { $url += 'health' }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $process.Refresh()
        if ($process.HasExited) { throw "$Name failed to start; see .runtime/$Name.stderr.log." }
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { Write-Host "$Name ready: $url"; return }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    $owned = Get-OwnedProcess $record
    if ($null -ne $owned) { Stop-Process -Id $owned.Id }
    throw "$Name did not respond. See logs in .runtime."
}

function Stop-OwnedServices {
    foreach ($name in @('frontend', 'backend')) {
        $stateFile = Join-Path $RuntimeDir "$name.json"
        if (Test-Path -LiteralPath $stateFile) {
            $record = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
            $owned = Get-OwnedProcess $record
            if ($null -ne $owned) { Stop-Process -Id $owned.Id -ErrorAction Stop }
            Remove-Item -LiteralPath $stateFile
        }
    }
}
