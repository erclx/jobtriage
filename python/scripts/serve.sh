#!/bin/bash
set -e
set -o pipefail

cd "$(dirname "$0")/.."

command -v uv >/dev/null 2>&1 || {
  echo "uv is not installed"
  exit 1
}

export JOBTRIAGE_API_HOST="${JOBTRIAGE_API_HOST:-127.0.0.1}"
export JOBTRIAGE_API_PORT="${JOBTRIAGE_API_PORT:-8000}"

if [[ "${1:-}" == "--reload" ]]; then
  export JOBTRIAGE_API_RELOAD=1
fi

exec uv run python -m jobtriage.api
