#!/usr/bin/env bash
set -euo pipefail

DB="Stock-Management-System"
BACKUP_DIR="/opt/mongo-backup"

: "${ATLAS_URI:?ATLAS_URI export karo (file mein mat likho)}"

echo ">> Atlas se dump le rahe hain..."
rm -rf "$BACKUP_DIR"
mongodump --uri="$ATLAS_URI" --out="$BACKUP_DIR"

echo ">> Container mein copy aur restore..."
docker cp "$BACKUP_DIR/$DB" debug-mongo:/tmp/restore-data
docker exec debug-mongo mongorestore --db="$DB" --drop --noIndexRestore /tmp/restore-data

echo ">> Collections ke counts:"
docker exec debug-mongo mongosh "$DB" --quiet --eval '
db.getCollectionNames().forEach(c => print(c + ": " + db.getCollection(c).countDocuments()))
'
echo ">> Done."
