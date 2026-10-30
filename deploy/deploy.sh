#!/bin/sh
# Pull the latest code and rebuild/restart the container. Data in ./pb_data is kept.
set -e
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
