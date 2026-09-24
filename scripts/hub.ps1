param(
    [ValidateSet('setup','dev','stop','test-fast','test','lint','check','smoke','migrate','reset-db','build','readiness')]
    [string]$Command = 'check',
    [string]$ConfirmReset = ''
)
. "$PSScriptRoot/common.ps1"
Push-Location $ProjectRoot
try {
    switch ($Command) {
        'setup' {
            foreach ($tool in @('python','node','npm.cmd','docker','git')) {
                if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing tool: $tool" }
            }
            Invoke-Native python @('-c', 'import sys; assert sys.version_info[:2] == (3, 12), "Python 3.12 required"')
            Invoke-Native node @('-e', 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)')
            Invoke-Native docker @('info','--format','{{.ServerVersion}}')
            if (-not (Test-Path -LiteralPath $PythonExe)) { Invoke-Native python @('-m','venv','.venv') }
            Invoke-Native $PythonExe @('-c', 'import sys; assert sys.version_info[:2] == (3, 12)')
            if (-not (Test-Path -LiteralPath '.env')) {
                Invoke-Native $PythonExe @('-c', 'from pathlib import Path; import secrets; p=Path(".env"); p.write_text(Path(".env.example").read_text().replace("local_dev_only", secrets.token_hex(24)),encoding="utf-8")')
            }
            Invoke-Native $PythonExe @('-m','pip','install','-r','requirements.lock','--disable-pip-version-check')
            Invoke-Native $PythonExe @('-m','pip','install','-e','.','--no-deps','--disable-pip-version-check')
            Invoke-Native npm.cmd @('--prefix','frontend','ci','--ignore-scripts','--no-audit','--no-fund')
            Invoke-Native docker @('compose','up','-d','--wait','--wait-timeout','60','postgres')
            Invoke-Native $PythonExe @('-c','from app.db.session import database_available; assert database_available(), "Database unavailable"')
            Invoke-Native $PythonExe @('-m','alembic','upgrade','head')
            Write-Host 'Local setup complete. Run scripts/dev.ps1 next. Frontend Base44 configuration is separate.'
        }
        'dev' {
            $config = Get-LocalConfig
            Invoke-Native docker @('compose','up','-d','--wait','--wait-timeout','60','postgres')
            Invoke-Native $PythonExe @('-m','alembic','upgrade','head')
            Start-OwnedService -Name backend -Exe $PythonExe -Arguments @('-m','uvicorn','app.main:app','--app-dir','backend','--host','127.0.0.1','--port',"$($config.api_port)",'--no-access-log') -Directory $ProjectRoot -Port $config.api_port
            $node = (Get-Command node -ErrorAction Stop).Source
            Start-OwnedService -Name frontend -Exe $node -Arguments @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$($config.frontend_port)",'--strictPort') -Directory (Join-Path $ProjectRoot 'frontend') -Port $config.frontend_port
            Write-Host 'Frontend server responds; Base44 login/data are not yet migrated.'
        }
        'stop' {
            Stop-OwnedServices
            Invoke-Native docker @('compose','stop','postgres')
            Write-Host 'Only this project stopped. Database volume preserved.'
        }
        'test-fast' { Assert-Python; Invoke-Native $PythonExe @('-m','pytest','backend/tests','-q') }
        'test' {
            Assert-Python
            $previousIntegration = $env:HUB_INTEGRATION
            try { $env:HUB_INTEGRATION = '1'; Invoke-Native $PythonExe @('-m','pytest','-q') }
            finally { $env:HUB_INTEGRATION = $previousIntegration }
        }
        'lint' {
            Assert-Python
            Invoke-Native $PythonExe @('-m','ruff','check','backend','tests','alembic','scripts')
            Invoke-Native $PythonExe @('-m','ruff','format','--check','backend','tests','alembic','scripts')
            Invoke-Native npm.cmd @('--prefix','frontend','run','lint')
        }
        'check' { Assert-Python; Invoke-AppPython @('scripts/readiness.py') }
        'readiness' { Assert-Python; Invoke-AppPython @('scripts/readiness.py') }
        'smoke' { Assert-Python; Invoke-AppPython @('scripts/smoke.py') }
        'migrate' { Assert-Python; Invoke-Native $PythonExe @('-m','alembic','upgrade','head') }
        'build' { Invoke-Native npm.cmd @('--prefix','frontend','run','build') }
        'reset-db' {
            $config = Get-LocalConfig
            $expected = "hub-$($config.service)"
            if ($ConfirmReset -cne $expected) {
                throw "Destructive operation refused. This deletes this project's local database. Explicitly pass -ConfirmReset $expected only when intended."
            }
            Stop-OwnedServices
            Invoke-Native docker @('compose','down','--volumes')
            Invoke-Native docker @('compose','up','-d','--wait','--wait-timeout','60','postgres')
            Invoke-Native $PythonExe @('-m','alembic','upgrade','head')
        }
    }
} finally { Pop-Location }
