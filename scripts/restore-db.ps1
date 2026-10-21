# Restaura um backup em um banco NOVO de verificação, compara contagens e apaga só esse banco.
# Nunca restaura no banco principal (MM-259). Ver scripts/db_backup.py.
param(
    [string]$File = '',
    [string]$Target = 'mediamind_restore_check'
)
. "$PSScriptRoot/common.ps1"
Assert-Python
$arguments = @((Join-Path $PSScriptRoot 'db_backup.py'), 'restore-check', '--target', $Target)
if ($File) { $arguments += @('--file', $File) }
Invoke-Native $PythonExe $arguments
