#!/bin/bash
set -e
set -o pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
WHITE='\033[1;37m'
GREY='\033[0;90m'
NC='\033[0m'

log_info() { echo -e "${GREY}│${NC} ${GREEN}✓${NC} $1" >&2; }
log_warn() { echo -e "${GREY}│${NC} ${YELLOW}!${NC} $1" >&2; }
log_error() {
  echo -e "${GREY}│${NC} ${RED}✗${NC} $1" >&2
  exit 1
}
log_step() { echo -e "${GREY}│${NC}\n${GREY}├${NC} ${WHITE}$1${NC}" >&2; }

open_timeline() {
  echo -e "${GREY}┌${NC}" >&2
  [ -n "${1:-}" ] && echo -e "${GREY}│${NC} ${WHITE}$1${NC}" >&2
}

close_timeline() {
  echo -e "${GREY}└${NC}" >&2
}

show_help() {
  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Usage:${NC} ./scripts/monitor.sh [interval]"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Arguments:${NC}"
  echo -e "${GREY}│${NC}    interval      ${GREY}# Sample interval in seconds (default: 3)${NC}"
  echo -e "${GREY}│${NC}    -h, --help    ${GREY}# Show this help${NC}"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Output:${NC}"
  echo -e "${GREY}│${NC}    stdout: tab-separated samples (host RAM, WSL RAM, GPU VRAM, loaded LLMs)"
  echo -e "${GREY}│${NC}    stderr: timeline UI and threshold warnings"
  echo -e "${GREY}└${NC}"
  exit 0
}

# shellcheck disable=SC2016
PS_QUERY='Get-CimInstance Win32_OperatingSystem | ForEach-Object { $u = ($_.TotalVisibleMemorySize - $_.FreePhysicalMemory) / 1MB; $t = $_.TotalVisibleMemorySize / 1MB; "{0:F1} {1:F1} {2:F1}" -f $u, $t, ($u/$t*100) }'

probe_host() {
  powershell.exe -NoProfile -Command "$PS_QUERY" 2>/dev/null | tr -d '\r' | tail -1
}

probe_wsl() {
  awk '
    /MemTotal:/ { total = $2 }
    /MemAvailable:/ { avail = $2 }
    END {
      used = total - avail
      printf "%.1f %.1f %.1f", used / 1024 / 1024, total / 1024 / 1024, (used / total) * 100
    }
  ' /proc/meminfo
}

probe_gpu() {
  nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu \
    --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d ' '
}

probe_llm() {
  local out
  out="$(ollama ps 2>/dev/null | tail -n +2 | awk 'NF>0 {printf "%s;", $1}')"
  if [ -z "$out" ]; then
    echo "none"
  else
    echo "${out%;}"
  fi
}

over_threshold() {
  awk -v p="${1:-0}" -v t="${2:-100}" 'BEGIN { exit !(p + 0 >= t + 0) }'
}

join_tabs() {
  local IFS=$'\t'
  printf '%s\n' "$*"
}

emit_header() {
  join_tabs \
    time \
    host_used_gb host_total_gb host_pct \
    wsl_used_gb wsl_total_gb wsl_pct \
    gpu_used_mib gpu_total_mib gpu_util_pct \
    llm_loaded
}

emit_sample() {
  local ts host_used host_total host_pct wsl_used wsl_total wsl_pct gpu_used gpu_total gpu_util llm
  ts="$(date +%H:%M:%S)"
  read -r host_used host_total host_pct <<<"$(probe_host)"
  read -r wsl_used wsl_total wsl_pct <<<"$(probe_wsl)"
  IFS=',' read -r gpu_used gpu_total gpu_util <<<"$(probe_gpu)"
  llm="$(probe_llm)"

  join_tabs \
    "$ts" \
    "${host_used:-?}" "${host_total:-?}" "${host_pct:-?}" \
    "${wsl_used:-?}" "${wsl_total:-?}" "${wsl_pct:-?}" \
    "${gpu_used:-?}" "${gpu_total:-?}" "${gpu_util:-?}" \
    "${llm:-none}"

  if over_threshold "${host_pct:-0}" "$HOST_WARN_PCT"; then
    log_warn "Host RAM at ${host_pct}% (threshold ${HOST_WARN_PCT}%)"
  fi
  if over_threshold "${gpu_util:-0}" "$GPU_WARN_PCT"; then
    log_warn "GPU util at ${gpu_util}% (threshold ${GPU_WARN_PCT}%)"
  fi
}

check_dependencies() {
  command -v powershell.exe >/dev/null 2>&1 || log_error "powershell.exe not on PATH (WSL2 only)"
  command -v nvidia-smi >/dev/null 2>&1 || log_error "nvidia-smi not installed"
  command -v ollama >/dev/null 2>&1 || log_error "ollama not installed"
  [ -r /proc/meminfo ] || log_error "/proc/meminfo not readable"
}

main() {
  case "${1:-}" in
  -h | --help) show_help ;;
  esac

  local interval="${1:-3}"

  HOST_WARN_PCT=85
  GPU_WARN_PCT=90

  check_dependencies

  open_timeline "Hardware monitor"
  trap close_timeline EXIT

  log_step "Sampling every ${interval}s, Ctrl-C to stop"
  log_info "Host RAM warns at ${HOST_WARN_PCT}%, GPU util warns at ${GPU_WARN_PCT}%"

  emit_header
  while true; do
    emit_sample
    sleep "$interval"
  done
}

main "$@"
