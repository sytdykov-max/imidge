@echo off
setlocal
set ROOT=%~dp0
powershell -NoExit -ExecutionPolicy Bypass -File "%ROOT%Stop-Imidge.ps1"
