#!/bin/bash
set -e
set -o pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_step() { echo -e "\n→ $1"; }
log_ok() { echo -e "${GREEN}✓${NC} $1"; }
log_fail() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

main() {
  cd "$(dirname "$0")/.."

  log_step "Format check"
  bun run check:format || log_fail "Format check failed"
  log_ok "Format check passed"

  log_step "Spell check"
  bun run check:spell || log_fail "Spell check failed"
  log_ok "Spell check passed"

  log_step "Shell check"
  bun run check:shell || log_fail "Shell check failed"
  log_ok "Shell check passed"

  log_step "Python verify"
  bash python/scripts/verify.sh || log_fail "Python verify failed"
  log_ok "Python verify passed"

  log_step "Web verify"
  bash web/scripts/verify.sh || log_fail "Web verify failed"
  log_ok "Web verify passed"

  echo -e "\n${GREEN}✓ Verification passed${NC}"
}

main "$@"
