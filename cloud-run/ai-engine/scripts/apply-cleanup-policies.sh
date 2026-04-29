#!/usr/bin/env bash

set -euo pipefail

REGION="${REGION:-asia-northeast1}"
REPOSITORY="${REPOSITORY:-cloud-run}"
PACKAGE="${PACKAGE:-ai-engine}"
MODE="${MODE:-plan}"
if [ "${APPLY:-false}" = "true" ]; then
  MODE="apply"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONFIG_DIR="${ENGINE_ROOT}/config"

ARTIFACT_POLICY_FILE="${ARTIFACT_POLICY_FILE:-${CONFIG_DIR}/artifact-registry-cleanup-policy.json}"
CLOUDBUILD_LIFECYCLE_FILE="${CLOUDBUILD_LIFECYCLE_FILE:-${CONFIG_DIR}/cloudbuild-source-lifecycle.json}"
RUN_SOURCE_LIFECYCLE_FILE="${RUN_SOURCE_LIFECYCLE_FILE:-${CONFIG_DIR}/run-source-lifecycle.json}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_file() {
  if [ ! -f "$1" ]; then
    echo "missing required file: $1" >&2
    exit 1
  fi
}

require_cmd gcloud
require_cmd jq

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "${PROJECT_ID}" ]; then
  echo "no Google Cloud project selected. Run 'gcloud config set project <PROJECT_ID>' first." >&2
  exit 1
fi

CLOUDBUILD_BUCKET="${CLOUDBUILD_BUCKET:-${PROJECT_ID}_cloudbuild}"
RUN_SOURCE_BUCKET="${RUN_SOURCE_BUCKET:-run-sources-${PROJECT_ID}-${REGION}}"

require_file "${ARTIFACT_POLICY_FILE}"
require_file "${CLOUDBUILD_LIFECYCLE_FILE}"
require_file "${RUN_SOURCE_LIFECYCLE_FILE}"

jq empty "${ARTIFACT_POLICY_FILE}"
jq empty "${CLOUDBUILD_LIFECYCLE_FILE}"
jq empty "${RUN_SOURCE_LIFECYCLE_FILE}"

echo "AI Engine cleanup policy apply"
echo "- project: ${PROJECT_ID}"
echo "- region: ${REGION}"
echo "- repository: ${REPOSITORY}"
echo "- package: ${PACKAGE}"
echo "- mode: ${MODE}"

case "${MODE}" in
  plan|dry-run|apply)
    ;;
  *)
    echo "invalid MODE=${MODE}. Use plan, dry-run, or apply." >&2
    exit 1
    ;;
esac

if [ "${MODE}" = "apply" ]; then
  artifact_cleanup_mode="--no-dry-run"
else
  artifact_cleanup_mode="--dry-run"
fi

echo
echo "== Artifact Registry cleanup policy =="
echo "gcloud artifacts repositories set-cleanup-policies ${REPOSITORY} --project=${PROJECT_ID} --location=${REGION} --policy=${ARTIFACT_POLICY_FILE} ${artifact_cleanup_mode}"
if [ "${MODE}" = "plan" ]; then
  echo "Plan mode only; no Artifact Registry changes applied."
  echo
  echo "== Cloud Storage lifecycle =="
  echo "gcloud storage buckets update gs://${CLOUDBUILD_BUCKET} --lifecycle-file=${CLOUDBUILD_LIFECYCLE_FILE}"
  echo "gcloud storage buckets update gs://${RUN_SOURCE_BUCKET} --lifecycle-file=${RUN_SOURCE_LIFECYCLE_FILE}"
  echo "Plan mode only; no Cloud Storage lifecycle changes applied."
  exit 0
fi

gcloud artifacts repositories set-cleanup-policies "${REPOSITORY}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --policy="${ARTIFACT_POLICY_FILE}" \
  "${artifact_cleanup_mode}" \
  --quiet

if [ "${MODE}" != "apply" ]; then
  echo
  echo "Storage lifecycle updates skipped because MODE=${MODE}."
  echo "Run with MODE=apply to update Cloud Storage bucket lifecycle configs."
  exit 0
fi

echo
echo "== Cloud Build source lifecycle =="
gcloud storage buckets update "gs://${CLOUDBUILD_BUCKET}" \
  --lifecycle-file="${CLOUDBUILD_LIFECYCLE_FILE}"

echo
echo "== Cloud Run source lifecycle =="
gcloud storage buckets update "gs://${RUN_SOURCE_BUCKET}" \
  --lifecycle-file="${RUN_SOURCE_LIFECYCLE_FILE}"

echo
echo "Cleanup policies applied."
