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

has_ref() {
  local ref="$1"
  git show-ref --verify --quiet "$ref"
}

resolve_public_remote() {
  local remote
  for remote in github-public origin; do
    if git remote get-url "$remote" >/dev/null 2>&1; then
      printf '%s\n' "$remote"
      return 0
    fi
  done
  return 1
}

print_header() {
  printf '\n== %s ==\n' "$1"
}

show_topology() {
  local public_remote=""
  require_ref "refs/remotes/gitlab/main"
  public_remote="$(resolve_public_remote || true)"

  print_header "Remotes"
  git remote -v

  print_header "Push Default"
  printf '%s\n' "$(git config --local --get remote.pushDefault || echo '(not set)')"

  print_header "Pointers"
  printf 'local main   %s\n' "$(git rev-parse --short HEAD)"
  printf 'gitlab/main  %s\n' "$(git rev-parse --short gitlab/main)"
  if [[ -n "$public_remote" ]] && has_ref "refs/remotes/$public_remote/main"; then
    printf '%s/main  %s\n' "$public_remote" "$(git rev-parse --short "$public_remote/main")"
  elif [[ -n "$public_remote" ]]; then
    printf '%s/main  %s\n' "$public_remote" "(missing remote-tracking ref)"
  else
    printf 'public remote  %s\n' "(not configured)"
  fi

  print_header "Canonical Graph"
  git log --graph --oneline --decorate --max-count="$COUNT" gitlab/main

  print_header "Public Snapshot Graph"
  if [[ -n "$public_remote" ]] && has_ref "refs/remotes/$public_remote/main"; then
    git log --graph --oneline --decorate --max-count="$COUNT" "$public_remote/main"
  elif [[ -n "$public_remote" ]]; then
    echo "Missing ref: refs/remotes/$public_remote/main"
    echo "Run: git fetch $public_remote"
  else
    echo "No GitHub public remote configured."
  fi

  print_header "Interpretation"
  echo "gitlab/main is the canonical private history."
  if [[ -n "$public_remote" ]]; then
    echo "$public_remote/main is a separate public snapshot history."
  else
    echo "GitHub public remote is not configured in this clone."
  fi
  echo "Seeing both in one --all graph is expected and does not mean history corruption."
}

show_doctor() {
  local push_default
  local upstream

  push_default="$(git config --local --get remote.pushDefault || echo '(not set)')"
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || echo '(no upstream)')"

  print_header "Remote Doctor"
  git remote -v

  print_header "Branch Routing"
  printf 'current branch  %s\n' "$(git branch --show-current)"
  printf 'upstream        %s\n' "$upstream"
  printf 'push default    %s\n' "$push_default"

  print_header "Provider Interpretation"
  cat <<EOF
IDE remote links often prefer origin.
In this repository, github-public is the preferred GitHub public snapshot remote.
Legacy clones may still keep origin for the GitHub public snapshot.
Canonical development and deployment still run from gitlab/main.
If your IDE opens GitHub links, that is expected and does not mean Vercel deploys from GitHub.
Do not repoint origin to GitLab here. Use gitlab for canonical push/fetch and npm run sync:github for public export.
EOF
}

show_canonical() {
  require_ref "refs/remotes/gitlab/main"
  git log --graph --oneline --decorate --max-count="$COUNT" gitlab/main
}

show_public() {
  local public_remote=""
  public_remote="$(resolve_public_remote || true)"
  if [[ -z "$public_remote" ]]; then
    echo "No GitHub public remote configured." >&2
    exit 1
  fi
  require_ref "refs/remotes/$public_remote/main"
  git log --graph --oneline --decorate --max-count="$COUNT" "$public_remote/main"
}

show_combined() {
  local public_remote=""
  require_ref "refs/remotes/gitlab/main"
  public_remote="$(resolve_public_remote || true)"
  if [[ -n "$public_remote" ]]; then
    require_ref "refs/remotes/$public_remote/main"
  fi
  git log --graph --oneline --decorate --max-count="$COUNT" --all
}

case "$MODE" in
  topology)
    show_topology
    ;;
  doctor)
    show_doctor
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
    echo "Usage: bash scripts/git/show-topology.sh [topology|doctor|canonical|public|all] [count]" >&2
    exit 1
    ;;
esac
