# PostgreSQL backup for Company Operations System.
#
# Creates a version-matched binary dump (pg_dump -Fc runs INSIDE the postgres
# container) and copies it to ./backups/ on the host with a timestamped name.
# Binary transfer via `docker cp` avoids PowerShell text-encoding corruption.
#
# Usage:  .\scripts\backup-db.ps1
# Output: backups\cos_db_YYYY-MM-DD_HH-mm.dump
#
# The backups/ directory is gitignored. Copy backup files to external storage
# (USB / network drive) for real off-machine protection.

$ErrorActionPreference = 'Stop'

$container = 'company-ops-postgres'
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'cos' }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'cos_db' }
$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm'
$backupDir = Join-Path $PSScriptRoot '..\backups'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$tmpInContainer = "/tmp/cos_backup_$stamp.dump"
$hostFile = Join-Path $backupDir "cos_db_$stamp.dump"

docker exec $container pg_dump -U $dbUser -Fc -f $tmpInContainer $dbName
docker cp "${container}:${tmpInContainer}" $hostFile
docker exec $container rm $tmpInContainer

$size = (Get-Item $hostFile).Length
Write-Output "Backup complete: $hostFile ($size bytes)"
