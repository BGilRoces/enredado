#!/usr/bin/env bash
# Abre un túnel SSH para que el Postgres de shared-infra (no expuesto a
# internet, ver docs/adr/0002) sea alcanzable en localhost:5432 durante el
# dev local. Requiere el alias `vps` en ~/.ssh/config.
set -euo pipefail

VPS_HOST="vps"
DB_CONTAINER_IP="10.0.1.5"
DB_PORT=5432

if lsof -i "tcp:${DB_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Ya hay algo escuchando en localhost:${DB_PORT} (¿el túnel ya está abierto?)."
  exit 0
fi

echo "Túnel abierto: localhost:${DB_PORT} -> ${DB_CONTAINER_IP}:${DB_PORT} (vía ${VPS_HOST})"
echo "Dejá esta terminal abierta. Ctrl+C para cortar."
exec ssh -N -L "${DB_PORT}:${DB_CONTAINER_IP}:${DB_PORT}" "${VPS_HOST}"
