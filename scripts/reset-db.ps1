param([string]$ConfirmReset = "")
& "$PSScriptRoot/hub.ps1" -Command reset-db -ConfirmReset $ConfirmReset
