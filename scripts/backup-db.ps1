# Backup do PostgreSQL local em .runtime/backups/ (MM-259). Ver scripts/db_backup.py.
. "$PSScriptRoot/common.ps1"
Assert-Python
Invoke-Native $PythonExe @((Join-Path $PSScriptRoot 'db_backup.py'), 'backup')
