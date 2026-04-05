#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-topology}"
COUNT="${2:-20}"

if ! [[ "$COUNT" =~ ^[0-9]+$ ]]; then
  echo "COUNT must be an integer" >&2
  exit 1
fi

require_ref() {
  local ref="$1"
  if ! git show-ref --verify --quiet "$ref"; then
    echo "Missing ref: $ref" >&2
    exit 1
  fi
}

print_header() {
  printf '\n== %s ==\n' "$1"
}

show_topology() {
  require_ref "refs/remotes/gitlab/main"
  require_ref "refs/remotes/origin/main"

  print_header "Remotes"
  git remote -v

  print_header "Pointers"
  printf 'local main   %s\n' "$(git rev-parse --short HEAD)"
  printf 'gitlab/main  %s\n' "$(git rev-parse --short gitlab/main)"
  printf 'origin/main  %s\n' "$(git rev-parse --short origin/main)"

  print_header "Canonical Graph"
  git log --graph --oneline --decorate --max-count="$COUNT" gitlab/main

  print_header "Public Snapshot Graph"
  git log --graph --oneline --decorate --max-count="$COUNT" origin/main

  print_header "Interpretation"
  echo "gitlab/main is the canonical private history."
  echo "origin/main is a separate public snapshot history."
  echo "Seeing both in one --all graph is expected and does not mean history corruption."
}

show_canonical() {
  require_ref "refs/remotes/gitlab/main"
  git log --graph --oneline --decorate --max-count="$COUNT" gitlab/main
}

show_public() {
  require_ref "refs/remotes/origin/main"
  git log --graph --oneline --decorate --max-count="$COUNT" origin/main
}

show_combined() {
  require_ref "refs/remotes/gitlab/main"
  require_ref "refs/remotes/origin/main"
  git log --graph --oneline --decorate --max-count="$COUNT" --all
}

case "$MODE" in
  topology)
    show_topology
    ;;
  canonical)
    show_canonical
    ;;
  public)
    show_public
    ;;
  all)
    show_combined
    ;;
  *)
    echo "Usage: bash scripts/git/show-topology.sh [topology|canonical|public|all] [count]" >&2
    exit 1
    ;;
esac
