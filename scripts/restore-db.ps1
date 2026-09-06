# PostgreSQL restore TEST for Company Operations System.
#
# Restores a backup file into a TEMPORARY database (never over production),
# verifies key tables, then drops the temporary database.
#
# Usage:  .\scripts\restore-db.ps1 -BackupFile backups\cos_db_YYYY-MM-DD_HH-mm.dump
#
# To restore FOR REAL (disaster recovery), after stopping the API:
#   docker exec company-ops-postgres dropdb -U cos --if-exists cos_db
#   docker exec company-ops-postgres createdb -U cos -O cos cos_db
#   docker cp <backup> company-ops-postgres:/tmp/restore.dump
#   docker exec company-ops-postgres pg_restore -U cos -d cos_db /tmp/restore.dump
#   docker exec company-ops-postgres rm /tmp/restore.dump

param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = 'Stop'

$container = 'company-ops-postgres'
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'cos' }
$testDb = 'cos_restore_test'

if (-not (Test-Path $BackupFile)) { throw "Backup file not found: $BackupFile" }

docker exec $container dropdb -U $dbUser --if-exists $testDb
docker exec $container createdb -U $dbUser -O $dbUser $testDb
docker cp $BackupFile "${container}:/tmp/restore_test.dump"
docker exec $container pg_restore -U $dbUser -d $testDb /tmp/restore_test.dump
docker exec $container rm /tmp/restore_test.dump

Write-Output '--- verification (temporary database) ---'
docker exec $container psql -U $dbUser -d $testDb -c 'SELECT (SELECT count(*) FROM projects) AS projects, (SELECT count(*) FROM boq_items) AS boq_items, (SELECT count(*) FROM ipcs) AS ipcs;'
docker exec $container psql -U $dbUser -d $testDb -c 'SELECT count(*) AS documents, (SELECT count(*) FROM document_revisions) AS revisions FROM documents;'

docker exec $container dropdb -U $dbUser $testDb
Write-Output 'Temporary database dropped. Production database was never touched.'
