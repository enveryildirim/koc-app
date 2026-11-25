#!/bin/sh
# Açılış: veri klasörlerini hazırla, bekleyen migration'ları uygula, sunucuyu başlat.
set -e
mkdir -p /app/data/storage /app/data/backups
node prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
exec node server.js
