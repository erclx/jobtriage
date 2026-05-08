#!/bin/bash
set -e
set -o pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
WHITE='\033[1;37m'
GREY='\033[0;90m'
NC='\033[0m'

PORT=3000
LOG_DIR=".claude/.tmp/restart"
LOG_FILE="${LOG_DIR}/server.log"
WAIT_SECONDS=120

log_info() { echo -e "${GREY}│${NC} ${GREEN}✓${NC} $1" >&2; }
log_warn() { echo -e "${GREY}│${NC} ${YELLOW}!${NC} $1" >&2; }
log_error() {
  echo -e "${GREY}│${NC} ${RED}✗${NC} $1" >&2
  exit 1
}
log_step() { echo -e "${GREY}│${NC}\n${GREY}├${NC} ${WHITE}$1${NC}" >&2; }
log_add() { echo -e "${GREY}│${NC} ${GREEN}+${NC} $1" >&2; }
log_rem() { echo -e "${GREY}│${NC} ${RED}-${NC} $1" >&2; }

open_timeline() {
  echo -e "${GREY}┌${NC}" >&2
  [ -n "${1:-}" ] && echo -e "${GREY}│${NC} ${WHITE}$1${NC}" >&2
}

close_timeline() {
  echo -e "${GREY}└${NC}" >&2
}

check_dependencies() {
  command -v bun >/dev/null 2>&1 || log_error "bun is not installed"
  command -v ss >/dev/null 2>&1 || log_error "ss is not installed (iproute2)"
}

find_port_pid() {
  ss -tlnp "sport = :${PORT}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1 || true
}

kill_pid() {
  local pid=$1
  kill -TERM "$pid" 2>/dev/null || true
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL "$pid" 2>/dev/null || true
  fi
}

stop_stale_processes() {
  local old_pid
  old_pid=$(find_port_pid)
  if [ -n "$old_pid" ]; then
    kill_pid "$old_pid"
    log_rem "next-server pid ${old_pid}"
  else
    log_info "Port ${PORT} already free"
  fi
  if pgrep -f '@playwright/test/cli.js test-server' >/dev/null 2>&1; then
    pkill -f '@playwright/test/cli.js test-server' 2>/dev/null || true
    log_rem "Playwright test-server zombies"
  fi
  echo "$old_pid"
}

start_server() {
  mkdir -p "$LOG_DIR"
  : >"$LOG_FILE"
  nohup bash -c 'cd web && bun run build && bun run start' >"$LOG_FILE" 2>&1 &
  disown
  log_add "Logs at ${LOG_FILE}"
}

wait_for_bind() {
  local deadline
  deadline=$(($(date +%s) + WAIT_SECONDS))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    local pid
    pid=$(find_port_pid)
    if [ -n "$pid" ]; then
      echo "$pid"
      return 0
    fi
    sleep 1
  done
  return 1
}

main() {
  check_dependencies

  open_timeline "Restart web server"
  trap close_timeline EXIT

  log_step "Stopping stale processes"
  local old_pid
  old_pid=$(stop_stale_processes)

  log_step "Starting fresh server"
  start_server

  log_step "Waiting for port ${PORT}"
  local new_pid
  if ! new_pid=$(wait_for_bind); then
    log_error "Server did not bind to port ${PORT} within ${WAIT_SECONDS}s. Check ${LOG_FILE}"
  fi
  if [ -n "$old_pid" ] && [ "$new_pid" = "$old_pid" ]; then
    log_error "Pid did not change. Old=${old_pid} new=${new_pid}"
  fi
  log_info "next-server pid ${new_pid} listening on ${PORT}"

  trap - EXIT
  echo -e "${GREY}└${NC}\n" >&2
  echo -e "${GREEN}✓ Web server restarted${NC}"
}

main "$@"
