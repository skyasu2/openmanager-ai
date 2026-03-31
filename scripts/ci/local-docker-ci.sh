#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENGINE_DIR="${ROOT_DIR}/cloud-run/ai-engine"

CI_DOCKER_IMAGE="${CI_DOCKER_IMAGE:-node:24-bookworm}"
CI_DOCKER_INSTALL_MODE="${CI_DOCKER_INSTALL_MODE:-prefer-local}"
CI_DOCKER_PULL_POLICY="${CI_DOCKER_PULL_POLICY:-if-not-present}"
CI_DOCKER_RUN_ENGINE_PREFLIGHT="${CI_DOCKER_RUN_ENGINE_PREFLIGHT:-false}"
CI_DOCKER_SKIP_ROOT="${CI_DOCKER_SKIP_ROOT:-false}"
CI_DOCKER_SKIP_ENGINE="${CI_DOCKER_SKIP_ENGINE:-false}"

log() {
  echo "[local-docker-ci] $*"
}

require_dir() {
  local path="$1"
  local message="$2"
  if [ ! -d "$path" ]; then
    log "$message"
    exit 1
  fi
}

ensure_docker() {
  local attempts="${CI_DOCKER_DAEMON_CHECK_RETRIES:-5}"
  local delay_sec="${CI_DOCKER_DAEMON_CHECK_DELAY_SEC:-2}"
  local attempt=1
  local docker_info_log=""
  local last_error=""

  while [ "$attempt" -le "$attempts" ]; do
    docker_info_log="$(mktemp)"

    if docker info >"${docker_info_log}" 2>&1; then
      rm -f "${docker_info_log}"
      return
    fi

    last_error="$(tail -n 20 "${docker_info_log}")"
    rm -f "${docker_info_log}"

    if [ "$attempt" -lt "$attempts" ]; then
      log "docker daemon not ready yet. retrying (${attempt}/${attempts})..."
      sleep "$delay_sec"
    fi

    attempt=$((attempt + 1))
  done

  log "docker daemon unavailable. Start Docker Desktop or enable WSL Docker integration."
  if [ -n "$last_error" ]; then
    log "last docker info error:"
    printf '%s\n' "$last_error"
  fi
  exit 1
}

ensure_install_mode() {
  case "$CI_DOCKER_INSTALL_MODE" in
    prefer-local|npm-ci) ;;
    *)
      log "unsupported CI_DOCKER_INSTALL_MODE: ${CI_DOCKER_INSTALL_MODE}"
      log "supported values: prefer-local | npm-ci"
      exit 1
      ;;
  esac
}

ensure_pull_policy() {
  case "$CI_DOCKER_PULL_POLICY" in
    always|if-not-present|never) ;;
    *)
      log "unsupported CI_DOCKER_PULL_POLICY: ${CI_DOCKER_PULL_POLICY}"
      log "supported values: always | if-not-present | never"
      exit 1
      ;;
  esac
}

ensure_image() {
  local image_exists="false"
  if docker image inspect "${CI_DOCKER_IMAGE}" >/dev/null 2>&1; then
    image_exists="true"
  fi

  case "$CI_DOCKER_PULL_POLICY" in
    always)
      log "pull policy: always"
      docker pull "${CI_DOCKER_IMAGE}"
      ;;
    if-not-present)
      log "pull policy: if-not-present"
      if [ "$image_exists" != "true" ]; then
        docker pull "${CI_DOCKER_IMAGE}"
      fi
      ;;
    never)
      log "pull policy: never"
      if [ "$image_exists" != "true" ]; then
        log "docker image missing locally: ${CI_DOCKER_IMAGE}"
        log "pull it manually first or use CI_DOCKER_PULL_POLICY=if-not-present."
        exit 1
      fi
      ;;
  esac
}

build_container_command() {
  local commands=()

  if [ "$CI_DOCKER_INSTALL_MODE" = "prefer-local" ]; then
    require_dir "${ROOT_DIR}/node_modules" \
      "root node_modules missing. Run 'npm install' first or set CI_DOCKER_INSTALL_MODE=npm-ci."
    require_dir "${ENGINE_DIR}/node_modules" \
      "cloud-run/ai-engine/node_modules missing. Run 'cd cloud-run/ai-engine && npm install' first or set CI_DOCKER_INSTALL_MODE=npm-ci."
  else
    commands+=("npm ci")
    commands+=("(cd cloud-run/ai-engine && npm ci)")
  fi

  if [ "$CI_DOCKER_SKIP_ROOT" != "true" ]; then
    commands+=("npm run validate:all")
  fi

  if [ "$CI_DOCKER_SKIP_ENGINE" != "true" ]; then
    commands+=("(cd cloud-run/ai-engine && npm run type-check && npm run test)")
  fi

  local joined=""
  local command
  for command in "${commands[@]}"; do
    if [ -n "$joined" ]; then
      joined="${joined} && "
    fi
    joined="${joined}${command}"
  done

  printf '%s' "$joined"
}

run_container_validation() {
  local network_args=()
  if [ "$CI_DOCKER_INSTALL_MODE" = "prefer-local" ]; then
    network_args=(--network none)
  fi

  local container_command
  container_command="$(build_container_command)"

  if [ -z "$container_command" ]; then
    log "nothing to run. Set CI_DOCKER_SKIP_ROOT/CI_DOCKER_SKIP_ENGINE to false."
    exit 1
  fi

  log "using image: ${CI_DOCKER_IMAGE}"
  log "install mode: ${CI_DOCKER_INSTALL_MODE}"

  docker run --rm \
    "${network_args[@]}" \
    -e CI=true \
    -e CI_DOCKER=true \
    -e NODE_ENV=test \
    -v "${ROOT_DIR}:/workspace" \
    -v "${HOME}/.npm:/root/.npm" \
    -w /workspace \
    "${CI_DOCKER_IMAGE}" \
    bash -lc "$container_command"
}

run_engine_preflight() {
  if [ "$CI_DOCKER_RUN_ENGINE_PREFLIGHT" != "true" ]; then
    return
  fi

  log "running AI Engine docker preflight"
  (
    cd "${ENGINE_DIR}"
    SKIP_RUN=true npm run docker:preflight
  )
}

main() {
  ensure_docker
  ensure_install_mode
  ensure_pull_policy

  log "starting local Docker CI"
  ensure_image
  run_container_validation
  run_engine_preflight
  log "local Docker CI passed"
}

main "$@"
