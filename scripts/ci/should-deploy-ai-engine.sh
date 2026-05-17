#!/usr/bin/env bash

set -euo pipefail

BASE_REF=""
HEAD_REF="${CI_COMMIT_SHA:-HEAD}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ci/should-deploy-ai-engine.sh [--base=<ref>] [--head=<ref>]

Prints one of:
  decision=deploy reason=<reason>
  decision=skip reason=<reason>

If the diff cannot be determined, the script chooses deploy.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base)
      BASE_REF="${2:-}"
      shift
      ;;
    --base=*)
      BASE_REF="${1#--base=}"
      ;;
    --head)
      HEAD_REF="${2:-}"
      shift
      ;;
    --head=*)
      HEAD_REF="${1#--head=}"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "decision=deploy reason=unknown_argument argument=$1"
      exit 0
      ;;
  esac
  shift
done

is_zero_sha() {
  case "${1:-}" in
    ""|0000000000000000000000000000000000000000)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_semver_tag() {
  [[ "${1:-}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

resolve_previous_semver_tag() {
  local current_tag="${CI_COMMIT_TAG:-}"

  git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname |
    while IFS= read -r tag; do
      if [ -n "$current_tag" ] && [ "$tag" = "$current_tag" ]; then
        continue
      fi
      printf '%s\n' "$tag"
      break
    done
}

resolve_base_ref() {
  if [ -n "$BASE_REF" ]; then
    printf '%s' "$BASE_REF"
    return 0
  fi

  if ! is_zero_sha "${CI_COMMIT_BEFORE_SHA:-}"; then
    printf '%s' "$CI_COMMIT_BEFORE_SHA"
    return 0
  fi

  if [ -n "${CI_COMMIT_TAG:-}" ]; then
    local previous_tag
    previous_tag="$(resolve_previous_semver_tag || true)"
    if [ -n "$previous_tag" ]; then
      printf '%s' "$previous_tag"
      return 0
    fi
  fi

  if git rev-parse --verify "${HEAD_REF}^" >/dev/null 2>&1; then
    git rev-parse "${HEAD_REF}^"
    return 0
  fi

  return 1
}

matches_ai_engine_path() {
  case "$1" in
    cloud-run/ai-engine/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_ai_engine_version_metadata_path() {
  case "$1" in
    cloud-run/ai-engine/package.json|cloud-run/ai-engine/package-lock.json)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_version_only_metadata_diff() {
  local file="$1"
  local diff_lines

  diff_lines="$(git diff --unified=0 "$base_ref" "$HEAD_REF" -- "$file" || true)"
  if [ -z "$diff_lines" ]; then
    return 0
  fi

  while IFS= read -r line; do
    case "$line" in
      "+++"*|"---"*|"@@"*)
        continue
        ;;
      "+"*|"-"*)
        if ! printf '%s\n' "$line" | grep -Eq '^[+-][[:space:]]*"version":[[:space:]]*"[^"]+"[,]?$'; then
          return 1
        fi
        ;;
    esac
  done <<EOF
$diff_lines
EOF

  return 0
}

base_ref="$(resolve_base_ref || true)"

if [ -z "$base_ref" ]; then
  echo "decision=deploy reason=base_ref_unavailable head=${HEAD_REF}"
  exit 0
fi

if ! git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
  echo "decision=deploy reason=base_ref_missing base=${base_ref} head=${HEAD_REF}"
  exit 0
fi

if ! git rev-parse --verify "$HEAD_REF" >/dev/null 2>&1; then
  echo "decision=deploy reason=head_ref_missing base=${base_ref} head=${HEAD_REF}"
  exit 0
fi

changed_files="$(git diff --name-only "$base_ref" "$HEAD_REF" || true)"
if [ -z "$changed_files" ]; then
  echo "decision=skip reason=no_changed_files base=${base_ref} head=${HEAD_REF}"
  exit 0
fi

ai_engine_changed_files=""
has_ai_engine_change=false
has_ai_engine_non_version_change=false

while IFS= read -r changed_file; do
  if matches_ai_engine_path "$changed_file"; then
    has_ai_engine_change=true
    ai_engine_changed_files="${ai_engine_changed_files}${changed_file} "
    if ! is_ai_engine_version_metadata_path "$changed_file"; then
      has_ai_engine_non_version_change=true
      break
    fi
  fi
done <<EOF
$changed_files
EOF

if [ "$has_ai_engine_non_version_change" = "true" ]; then
  echo "decision=deploy reason=ai_engine_change file=${changed_file} base=${base_ref} head=${HEAD_REF}"
  exit 0
fi

if [ "$has_ai_engine_change" = "true" ]; then
  while IFS= read -r changed_file; do
    if matches_ai_engine_path "$changed_file" && ! is_version_only_metadata_diff "$changed_file"; then
      echo "decision=deploy reason=ai_engine_metadata_content_change file=${changed_file} base=${base_ref} head=${HEAD_REF}"
      exit 0
    fi
  done <<EOF
$changed_files
EOF

  if is_semver_tag "${CI_COMMIT_TAG:-}"; then
    echo "decision=deploy reason=ai_engine_version_metadata_release_tag files=\"${ai_engine_changed_files% }\" tag=${CI_COMMIT_TAG} base=${base_ref} head=${HEAD_REF}"
    exit 0
  fi

  echo "decision=skip reason=ai_engine_version_metadata_only files=\"${ai_engine_changed_files% }\" base=${base_ref} head=${HEAD_REF}"
  exit 0
fi

echo "decision=skip reason=no_ai_engine_changes base=${base_ref} head=${HEAD_REF}"
