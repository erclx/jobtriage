#!/bin/bash
set -e
set -o pipefail

cd "$(dirname "$0")/.."

command -v uv >/dev/null 2>&1 || {
  echo "uv is not installed"
  exit 1
}

uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -v
