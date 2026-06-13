#!/bin/sh
set -eu

mkdir -p /app/data /app/uploads /app/reports /app/backups

npm run prisma:migrate:deploy
npm run seed:prod

exec node dist/main.js
