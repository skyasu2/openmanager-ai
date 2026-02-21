#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_TAG="${IMAGE_TAG:-openmanager-ai-engine:preflight}"
CONTAINER_NAME="${CONTAINER_NAME:-ai-engine-preflight}"
HEALTH_PORT="${HEALTH_PORT:-18080}"
SKIP_RUN="${SKIP_RUN:-false}"

DOCKER_MODE=""

ensure_build_assets() {
  # Ensure config exists
  if [ ! -f "${ENGINE_DIR}/config/system-rules.json" ]; then
    if [ -f "${ENGINE_DIR}/../../src/config/rules/system-rules.json" ]; then
      mkdir -p "${ENGINE_DIR}/config"
      cp "${ENGINE_DIR}/../../src/config/rules/system-rules.json" "${ENGINE_DIR}/config/system-rules.json"
      log "synced config/system-rules.json from src/config/rules"
    else
      log "missing config/system-rules.json (and source file not found)"
      exit 1
    fi
  fi

  # Ensure OTel SSOT data exists for Dockerfile COPY data/otel-data/
  # Always re-sync from source to keep preflight consistent with deploy.sh
  local needs_sync="false"
  if [ ! -f "${ENGINE_DIR}/data/otel-data/resource-catalog.json" ]; then
    needs_sync="true"
  elif [ "${FORCE_SYNC:-false}" = "true" ]; then
    needs_sync="true"
  elif [ -f "${ENGINE_DIR}/../../public/data/otel-data/resource-catalog.json" ]; then
    # Re-sync if source is newer than local copy
    if [ "${ENGINE_DIR}/../../public/data/otel-data/resource-catalog.json" -nt "${ENGINE_DIR}/data/otel-data/resource-catalog.json" ]; then
      needs_sync="true"
    fi
  fi

  if [ "$needs_sync" = "true" ]; then
    mkdir -p "${ENGINE_DIR}/data/otel-data/hourly"

    if [ -f "${ENGINE_DIR}/../../public/data/otel-data/resource-catalog.json" ]; then
      cp "${ENGINE_DIR}/../../public/data/otel-data/resource-catalog.json" "${ENGINE_DIR}/data/otel-data/"
      cp "${ENGINE_DIR}/../../public/data/otel-data/hourly/"*.json "${ENGINE_DIR}/data/otel-data/hourly/"
      log "synced data/otel-data from public/data/otel-data"
    else
      log "missing OTel data source (public/data/otel-data not found)"
      exit 1
    fi
  fi
}

log() {
  echo "[docker-preflight] $*"
}

cleanup() {
  if [ "$SKIP_RUN" = "true" ]; then
    return
  fi

  if [ -z "$DOCKER_MODE" ]; then
    return
  fi

  if [ "$DOCKER_MODE" = "wsl" ]; then
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  else
    cmd.exe /c docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if docker ps >/dev/null 2>&1; then
  DOCKER_MODE="wsl"
  log "docker daemon reachable in WSL"
elif cmd.exe /c docker ps; then
  DOCKER_MODE="windows-cli"
  log "docker daemon not reachable in WSL, using Windows Docker CLI fallback"
else
  log "docker daemon unavailable. Start Docker Desktop and retry."
  exit 1
fi

cd "$ENGINE_DIR"
ensure_build_assets

if [ "$DOCKER_MODE" = "wsl" ]; then
  docker build -t "$IMAGE_TAG" .
else
  WINDOWS_ENGINE_DIR="$(wslpath -w "$ENGINE_DIR")"
  cmd.exe /c docker build -t "$IMAGE_TAG" "$WINDOWS_ENGINE_DIR"
fi

if [ "$SKIP_RUN" = "true" ]; then
  log "build completed (run skipped: SKIP_RUN=true)"
  exit 0
fi

if [ "$DOCKER_MODE" = "wsl" ]; then
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER_NAME" -p "${HEALTH_PORT}:8080" "$IMAGE_TAG" >/dev/null
else
  cmd.exe /c docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  cmd.exe /c docker run -d --name "$CONTAINER_NAME" -p "${HEALTH_PORT}:8080" "$IMAGE_TAG" >/dev/null
fi

sleep 3
HEALTH_JSON="$(curl -fsS "http://localhost:${HEALTH_PORT}/health")"
log "health check passed: ${HEALTH_JSON}"
log "preflight completed"
