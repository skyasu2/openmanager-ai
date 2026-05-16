#!/usr/bin/env bash
set -euo pipefail

strict_latest=false

for arg in "$@"; do
  case "$arg" in
    --strict-latest)
      strict_latest=true
      ;;
    -h|--help)
      cat <<'EOF'
Usage: npm run check:ai-sdk -- [--strict-latest]

Checks root and AI Engine AI SDK dependencies against the npm registry.

Failures:
  - declared package.json base version does not exist
  - package-lock installed version does not exist
  - package-lock entry is missing for a declared AI SDK dependency

Warnings by default:
  - installed version differs from npm dist-tag latest

Use --strict-latest to turn latest mismatches into failures.
EOF
      exit 0
      ;;
    *)
      echo "ERROR unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

json_has_version() {
  local version="$1"
  node -e '
const fs = require("node:fs");
const metadata = JSON.parse(fs.readFileSync(0, "utf8"));
const version = process.argv[1];
process.exit((metadata.versions || []).includes(version) ? 0 : 1);
' "$version"
}

json_latest() {
  node -e '
const fs = require("node:fs");
const metadata = JSON.parse(fs.readFileSync(0, "utf8"));
process.stdout.write(metadata["dist-tags"]?.latest || "");
'
}

collect_specs() {
  node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const workspaces = [
  {
    name: 'root',
    packageJson: 'package.json',
    packageLock: 'package-lock.json',
  },
  {
    name: 'ai-engine',
    packageJson: 'cloud-run/ai-engine/package.json',
    packageLock: 'cloud-run/ai-engine/package-lock.json',
  },
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8'));
}

function isAiSdkPackage(packageName) {
  return packageName === 'ai' || packageName.startsWith('@ai-sdk/');
}

function extractVersion(spec) {
  if (typeof spec !== 'string') return '';
  return spec.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)?.[0] ?? '';
}

for (const workspace of workspaces) {
  const packageJson = readJson(workspace.packageJson);
  const packageLock = readJson(workspace.packageLock);
  const rows = [];

  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const dependencies = packageJson[section] ?? {};
    for (const [packageName, spec] of Object.entries(dependencies)) {
      if (!isAiSdkPackage(packageName)) continue;
      rows.push({
        workspace: workspace.name,
        packageName,
        spec,
        declaredVersion: extractVersion(spec),
        lockVersion:
          packageLock.packages?.[`node_modules/${packageName}`]?.version ?? '',
      });
    }
  }

  for (const row of rows.sort((a, b) => a.packageName.localeCompare(b.packageName))) {
    console.log(
      [
        row.workspace,
        row.packageName,
        row.spec,
        row.declaredVersion,
        row.lockVersion,
      ].join('\t'),
    );
  }
}
NODE
}

declare -A registry_cache
errors=0
warnings=0

while IFS=$'\t' read -r workspace package_name spec declared_version lock_version; do
  if [[ -z "${registry_cache[$package_name]:-}" ]]; then
    if ! registry_cache[$package_name]="$(npm view "$package_name" versions dist-tags --json)"; then
      echo "ERROR $workspace $package_name: npm registry lookup failed" >&2
      errors=$((errors + 1))
      continue
    fi
  fi

  metadata="${registry_cache[$package_name]}"
  latest="$(printf '%s' "$metadata" | json_latest)"

  printf '%-9s %-18s declared=%-10s lock=%-8s latest=%s\n' \
    "$workspace" "$package_name" "$spec" "${lock_version:-missing}" "$latest"

  if [[ -z "$declared_version" ]]; then
    echo "ERROR $workspace $package_name: unsupported package.json spec \"$spec\""
    errors=$((errors + 1))
  elif ! printf '%s' "$metadata" | json_has_version "$declared_version"; then
    echo "ERROR $workspace $package_name: package.json declares $spec, but $declared_version is not published"
    errors=$((errors + 1))
  fi

  if [[ -z "$lock_version" ]]; then
    echo "ERROR $workspace $package_name: package-lock entry is missing"
    errors=$((errors + 1))
  elif ! printf '%s' "$metadata" | json_has_version "$lock_version"; then
    echo "ERROR $workspace $package_name: package-lock installs $lock_version, but it is not published"
    errors=$((errors + 1))
  fi

  if [[ -n "$latest" && -n "$lock_version" && "$lock_version" != "$latest" ]]; then
    if [[ "$strict_latest" == true ]]; then
      echo "ERROR $workspace $package_name: installed $lock_version differs from npm latest $latest"
      errors=$((errors + 1))
    else
      echo "WARN $workspace $package_name: installed $lock_version differs from npm latest $latest"
      warnings=$((warnings + 1))
    fi
  fi
done < <(collect_specs)

if [[ "$errors" -gt 0 ]]; then
  echo "FAIL AI SDK registry check found $errors error(s)"
  exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
  echo "PASS all AI SDK package versions are published ($warnings warning(s))"
else
  echo "PASS all AI SDK package versions are published and current"
fi
