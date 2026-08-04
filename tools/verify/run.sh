#!/usr/bin/env bash
# ============================================================================
# Runs the verification suites against one or all demo sites.
#
#   tools/verify/run.sh                 # every suite, every site
#   tools/verify/run.sh fintech         # every suite, one site
#   tools/verify/run.sh fintech review  # one suite, one site
#
# Sites run CONCURRENTLY, JOBS at a time (default 3). Each site's output is
# buffered and printed whole, in the usual order, so the log reads exactly as
# it did when this ran serially. Suites within a site still run in order.
#
#   JOBS=1 tools/verify/run.sh          # the old serial behaviour
#   JOBS=5 tools/verify/run.sh          # faster, needs the memory for 5 Chromiums
#
# Nothing about what is asserted changed. This is wall-clock only: every suite
# still runs against every site it ran against before.
#
# Starts a static server on $PORT (default 8101) rooted at the repository
# root if nothing is listening there yet, and stops it again on exit.
# ============================================================================
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORT="${PORT:-8101}"
JOBS="${JOBS:-3}"
export BASE_URL="http://localhost:${PORT}"

SITES_ALL=(cantu-pneus cantu-pneus-en cantu-pneus-ru fintech banking)
# Suites that take a site argument. The panel suites cover the panel-content
# files, which live under cantu-pneus only.
SUITES_PER_SITE=(review sdkfull aligntest modaltest ptsweep revealtest slottest searchwishtest appevents mobile inlinetest gatetest portaltest)
SUITES_PANEL=(paneltest formtest persotest offsettest pttext rutext)

started_server=0
if ! curl -fsS -o /dev/null "${BASE_URL}/" 2>/dev/null; then
  echo "starting static server on ${PORT} ..."
  (cd "$REPO" && setsid nohup python3 -m http.server "$PORT" >/tmp/dengage-verify-server.log 2>&1 </dev/null &)
  started_server=1
  for _ in $(seq 1 20); do
    curl -fsS -o /dev/null "${BASE_URL}/" 2>/dev/null && break
    sleep 0.5
  done
fi

WORK="$(mktemp -d)"
cleanup() {
  if [ "$started_server" = "1" ]; then
    pkill -f "http.server ${PORT}" 2>/dev/null || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

site_arg="${1:-}"
suite_arg="${2:-}"

if [ -n "$site_arg" ]; then SITES=("$site_arg"); else SITES=("${SITES_ALL[@]}"); fi
if [ -n "$suite_arg" ]; then SUITES=("$suite_arg"); else SUITES=("${SUITES_PER_SITE[@]}"); fi

# Runs every suite for one target, in order, into its own log. Writes the
# failure count as the last line so the parent can total them up: a background
# job's exit status is not reachable once we are collecting in order.
run_target() {
  local label="$1" site="$2" log="$3"; shift 3
  local f=0 suite
  # Per-target screenshot directory. review.js defaults to a single fixed
  # /tmp/dengage-verify and clears it with rmSync before creating it, so with
  # sites running concurrently one target deletes the directory another is
  # writing into and the loser dies with ENOENT on mkdir. Giving each target
  # its own directory is the fix; the suite already honours OUT_DIR.
  local out="/tmp/dengage-verify-${site}"
  {
    echo
    echo "################  ${label}  ################"
    for suite in "$@"; do
      printf '\n---- %s ----\n' "$suite"
      # Capture the output as well as the status. A suite that PRINTS its
      # failures and then exits 0 was being counted as green: sdkfull.js did
      # exactly that and hid a real FinTech failure from 30 July until 2 August,
      # and 15 of the 25 suites share the shape, including searchwishtest and
      # slottest, which CLAUDE.md names as the things that catch a shared-module
      # drift. push.sh is the gate in front of five live demos, so it cannot be
      # allowed to depend on every suite remembering to set its exit code.
      #
      # Found by the Banking session, confirmed here by running sdkfull.js
      # against fintech and reading "EXIT CODE: 0" under a printed FAIL.
      local output status
      output="$(OUT_DIR="$out" node "${REPO}/tools/verify/${suite}.js" "$site" 2>&1)"
      status=$?
      printf '%s\n' "$output"
      # The markers every suite in this directory already prints on failure.
      if [ "$status" -ne 0 ] \
         || printf '%s' "$output" | grep -qE '^(FAIL|  FAIL) ' \
         || printf '%s' "$output" | grep -qE '[0-9]+ (CHECK\(S\)|check\(s\)) FAILED' \
         || printf '%s' "$output" | grep -qE '^[0-9]+ (form|viewport|SUITE)'; then
        f=$((f + 1))
        echo "SUITE FAILED: ${suite} on ${label} (exit ${status})"
      fi
    done
  } > "$log" 2>&1
  echo "$f" > "${log}.fails"
}

i=0
for site in "${SITES[@]}"; do
  run_target "$site" "$site" "${WORK}/$(printf '%02d' "$i").log" "${SUITES[@]}" &
  i=$((i + 1))
  # Cap concurrency. `wait -n` needs bash 4.3; fall back to draining all of it.
  while [ "$(jobs -rp | wc -l)" -ge "$JOBS" ]; do
    wait -n 2>/dev/null || wait
  done
done

# Panel-content suites are site-independent; run them once unless a single
# suite was requested explicitly.
if [ -z "$suite_arg" ]; then
  run_target "panel content (cantu-pneus)" cantu-pneus \
    "${WORK}/$(printf '%02d' "$i").log" "${SUITES_PANEL[@]}" &
  i=$((i + 1))

  # NovaPay has its own panel content set, because a campaign holds one piece
  # of content: sharing the unprefixed campaigns is exactly why the FinTech
  # site's eight Default Scenarios showed tyre-shop creative. Only paneltest
  # applies; the other panel suites cover cantu-pneus-only content.
  run_target "panel content (fintech)" fintech \
    "${WORK}/$(printf '%02d' "$i").log" paneltest &
  i=$((i + 1))
fi

wait

fails=0
for log in "${WORK}"/*.log; do
  cat "$log"
  fails=$((fails + $(cat "${log}.fails" 2>/dev/null || echo 1)))
done

echo
if [ "$fails" -eq 0 ]; then
  echo "================  ALL SUITES PASSED  ================"
else
  echo "================  ${fails} SUITE(S) FAILED  ================"
fi
exit "$fails"
