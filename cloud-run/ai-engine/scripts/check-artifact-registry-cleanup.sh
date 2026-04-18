#!/usr/bin/env bash

set -euo pipefail

REGION="${REGION:-asia-northeast1}"
REPOSITORY="${REPOSITORY:-cloud-run}"
PACKAGE="${PACKAGE:-ai-engine}"
FRESHNESS="${FRESHNESS:-30d}"
FILES_BY_DAY_LIMIT="${FILES_BY_DAY_LIMIT:-15}"
RECENT_FILES_LIMIT="${RECENT_FILES_LIMIT:-20}"
DELETE_LOG_LIMIT="${DELETE_LOG_LIMIT:-20}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
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

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
SERVICE_ACCOUNT="service-${PROJECT_NUMBER}@gcp-sa-artifactregistry.iam.gserviceaccount.com"
REPOSITORY_RESOURCE="projects/${PROJECT_ID}/locations/${REGION}/repositories/${REPOSITORY}"
PARENT_RESOURCE="${REPOSITORY_RESOURCE}/packages/-"

FILES_JSON="$(mktemp)"
trap 'rm -f "${FILES_JSON}"' EXIT

echo "Artifact Registry Cleanup Recheck"
echo "- project: ${PROJECT_ID}"
echo "- region: ${REGION}"
echo "- repository: ${REPOSITORY}"
echo "- package: ${PACKAGE}"
echo "- freshness: ${FRESHNESS}"
echo "- artifact registry service account: ${SERVICE_ACCOUNT}"

echo
echo "== Audit Config =="
gcloud projects get-iam-policy "${PROJECT_ID}" --format=json \
  | jq '(.auditConfigs // []) | map(select(.service=="artifactregistry.googleapis.com" or .service=="allServices"))'

echo
echo "== Repository =="
gcloud artifacts repositories describe "${REPOSITORY}" \
  --location="${REGION}" \
  --format='yaml(name,updateTime,cleanupPolicies,cleanupPolicyDryRun)'

echo
echo "== Versions =="
gcloud artifacts versions list \
  --package="${PACKAGE}" \
  --repository="${REPOSITORY}" \
  --location="${REGION}" \
  --format='table(name,createTime,relatedTags)'

echo
echo "== Files By Day =="
gcloud artifacts files list \
  --repository="${REPOSITORY}" \
  --location="${REGION}" \
  --format=json > "${FILES_JSON}"

jq -r --argjson limit "${FILES_BY_DAY_LIMIT}" '
  map(select(.sizeBytes != null))
  | group_by(.createTime[0:10])
  | map({
      date: .[0].createTime[0:10],
      count: length,
      bytes: (map(.sizeBytes | tonumber) | add)
    })
  | sort_by(.bytes)
  | reverse
  | .[:$limit]
  | .[]
  | [
      .date,
      (.count | tostring),
      (.bytes | tostring),
      ((((.bytes / 1048576) * 100) | floor) / 100 | tostring)
    ]
  | @tsv
' "${FILES_JSON}" \
  | awk 'BEGIN { printf "%-12s %-8s %-14s %s\n", "DATE", "COUNT", "BYTES", "MIB" } { printf "%-12s %-8s %-14s %s\n", $1, $2, $3, $4 }'

echo
echo "== Recent Files =="
jq -r --argjson limit "${RECENT_FILES_LIMIT}" '
  map(select(.sizeBytes != null))
  | sort_by(.createTime)
  | reverse
  | .[:$limit]
  | .[]
  | [
      .createTime,
      (.sizeBytes | tostring),
      .name
    ]
  | @tsv
' "${FILES_JSON}" \
  | awk 'BEGIN { printf "%-30s %-12s %s\n", "CREATE_TIME", "BYTES", "NAME" } { printf "%-30s %-12s %s\n", $1, $2, $3 }'

echo
echo "== Cleanup Delete Logs =="
gcloud logging read \
  "protoPayload.serviceName=\"artifactregistry.googleapis.com\" AND protoPayload.request.parent=\"${PARENT_RESOURCE}\" AND protoPayload.authenticationInfo.principalEmail=\"${SERVICE_ACCOUNT}\" AND (protoPayload.methodName:\"DeleteVersion\" OR protoPayload.methodName:\"BatchDeleteVersions\" OR protoPayload.methodName:\"DeletePackage\")" \
  --project="${PROJECT_ID}" \
  --freshness="${FRESHNESS}" \
  --limit="${DELETE_LOG_LIMIT}" \
  --format='table(timestamp,protoPayload.methodName,protoPayload.authenticationInfo.principalEmail,protoPayload.resourceName)'

echo
echo "== Recent Tag Delete Logs =="
gcloud logging read \
  "protoPayload.serviceName=\"artifactregistry.googleapis.com\" AND protoPayload.resourceName:\"${REPOSITORY_RESOURCE}\" AND protoPayload.methodName:\"DeleteTag\"" \
  --project="${PROJECT_ID}" \
  --freshness="${FRESHNESS}" \
  --limit="${DELETE_LOG_LIMIT}" \
  --format='table(timestamp,protoPayload.methodName,protoPayload.authenticationInfo.principalEmail,protoPayload.resourceName)'

echo
echo "== Notes =="
echo "- Cleanup policy version deletions require Artifact Registry DATA_WRITE audit logging."
echo "- Google cleanup background jobs can take about one day to reflect policy changes."
echo "- If 'Cleanup Delete Logs' is empty before the 7-day threshold passes, that is expected."
