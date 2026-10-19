#!/usr/bin/env bash
# Abre un túnel SSH para que el Postgres de shared-infra (no expuesto a
# internet, ver docs/adr/0002) sea alcanzable en localhost:5433 durante el
# dev local. Requiere el alias `vps` en ~/.ssh/config. Puerto local 5433 y no
# 5432 para no chocar con un Postgres local (ej. un contenedor de Docker de
# otro proyecto), que dejaba al panel conectándose a la base equivocada.
set -euo pipefail

VPS_HOST="vps"
DB_CONTAINER_IP="10.0.1.5"
DB_PORT=5432
LOCAL_PORT="${DB_TUNNEL_PORT:-5433}"

if lsof -i "tcp:${LOCAL_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Ya hay algo escuchando en localhost:${LOCAL_PORT} (¿el túnel ya está abierto?)."
  exit 0
fi

echo "Túnel abierto: localhost:${LOCAL_PORT} -> ${DB_CONTAINER_IP}:${DB_PORT} (vía ${VPS_HOST})"
echo "Dejá esta terminal abierta. Ctrl+C para cortar."
exec ssh -N -L "${LOCAL_PORT}:${DB_CONTAINER_IP}:${DB_PORT}" "${VPS_HOST}"
