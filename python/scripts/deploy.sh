#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

SERVICE_NAME="${JOBTRIAGE_CLOUD_RUN_SERVICE:-jobtriage}"
REGION="${JOBTRIAGE_CLOUD_RUN_REGION:-europe-west1}"

command -v gcloud >/dev/null 2>&1 || {
  echo "gcloud is not installed or not on PATH"
  exit 1
}

exec gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars JOBTRIAGE_DEPLOY_MODE=slim \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --port 8080
