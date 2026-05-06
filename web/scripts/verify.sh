#!/bin/bash
set -e
set -o pipefail

cd "$(dirname "$0")/.."

command -v bun >/dev/null 2>&1 || {
  echo "bun is not installed"
  exit 1
}

bun run typecheck
bun run lint
bun run test:run
