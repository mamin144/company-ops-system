# Local PostgreSQL backup (no Docker needed).
# Dumps cos_db with pg_dump (custom format) into backups/ with a timestamp.
# Keeps the newest 14 dumps, deletes older ones.
# Scheduled daily via Task Scheduler (see scripts/install-service.ps1).

$ErrorActionPreference = 'Stop'

$pgDump = 'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe'
$env:PGPASSWORD = 'cos-local-dev-password'
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$backupDir = Join-Path $PSScriptRoot '..\backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$hostFile = Join-Path $backupDir "cos_db_$stamp.dump"

& $pgDump -U cos -h 127.0.0.1 -p 5432 -Fc -f $hostFile cos_db
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

Get-ChildItem $backupDir -Filter 'cos_db_*.dump' |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 14 |
  Remove-Item -Force -ErrorAction SilentlyContinue

$size = (Get-Item $hostFile).Length
Write-Output "Backup complete: $hostFile ($size bytes)"
