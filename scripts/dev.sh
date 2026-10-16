#!/usr/bin/env bash
#
# Start every process the platform needs for local development.
#
#   npm run dev:all
#
# The platform is not a single server: the Next.js app, the Python controller
# API, its Celery worker and the WebSocket terminal are four separate
# processes. Forgetting one produces a confusing partial failure — a missing
# terminal service, for instance, only shows up as "Connect" doing nothing on
# the server page — so this starts them together and stops them together.
#
# Output is interleaved with a per-process prefix. Ctrl-C stops everything.

set -uo pipefail
cd "$(dirname "$0")/.."

VENV="controller/env/bin/activate"
PIDS=()
PORTS=(3000 8000 8765)

# Children are forked before shutdown begins, so a shell variable set in
# cleanup would never reach them. A file both sides can see does.
STOP_FLAG=$(mktemp -t unityalgo-dev)
rm -f "$STOP_FLAG"

DIM=$'\033[2m'; RESET=$'\033[0m'
BLUE=$'\033[34m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; MAGENTA=$'\033[35m'; RED=$'\033[31m'

log() { printf '%s[dev]%s %s\n' "$DIM" "$RESET" "$1"; }

# Prefix each line of a child's output so interleaved logs stay readable.
# A read loop rather than `sed`: BSD sed on macOS has no -u, so it would block
# output in 4KB chunks and make the logs useless for watching startup.
#
# A child that exits announces itself loudly. Python's reloader quits on an
# import error, and a process dying quietly in a wall of other output is the
# exact confusion this script exists to prevent.
run() {
    local name="$1" colour="$2"; shift 2
    local prefix
    prefix=$(printf '%s%-10s%s │ ' "$colour" "$name" "$RESET")
    (
        "$@" 2>&1 | while IFS= read -r line; do
            printf '%s%s\n' "$prefix" "$line"
        done
        [[ -e $STOP_FLAG ]] && exit 0
        printf '\n%s[dev]%s %s exited — the rest are still running.\n' "$RED" "$RESET" "$name"
        printf '      Fix the error above, then restart everything (Ctrl-C, then npm run dev:all).\n\n'
    ) &
    PIDS+=($!)
}

stopping=0
cleanup() {
    # The EXIT trap fires again after an INT, and killing children can trip it
    # a third time; without this guard the shutdown message repeats.
    [[ $stopping == 1 ]] && return
    stopping=1
    # Tell the children this is a deliberate stop, before killing anything.
    : > "$STOP_FLAG"
    log "shutting down…"

    for pid in "${PIDS[@]:-}"; do
        kill "$pid" 2>/dev/null
    done

    # `next dev` and celery both fork children that outlive the pipeline above
    # and keep holding their ports, which would make the next run fail the
    # preflight check. Clear anything still listening.
    for port in "${PORTS[@]}"; do
        local held
        held=$(lsof -i ":$port" -sTCP:LISTEN -t 2>/dev/null)
        [[ -n "$held" ]] && kill $held 2>/dev/null
    done

    wait 2>/dev/null
    rm -f "$STOP_FLAG"
    log "done"
}
trap cleanup EXIT INT TERM

# --- preflight ----------------------------------------------------------
if [[ ! -f "$VENV" ]]; then
    printf '%s[dev]%s controller virtualenv missing. Create it with:\n' "$RED" "$RESET"
    printf '      cd controller && python3 -m venv env && source env/bin/activate && pip install -r requirements.txt\n'
    exit 1
fi

for port in "${PORTS[@]}"; do
    if lsof -i ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        printf '%s[dev]%s port %s is already in use — stop that process first.\n' "$RED" "$RESET" "$port"
        exit 1
    fi
done

# Redis backs Celery. Without it the worker cannot start, and queued work
# (provision, migrate, backup) would sit at "pending" forever.
REDIS_OK=1
if ! (command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1); then
    REDIS_OK=0
    printf '%s[dev]%s Redis is not reachable — starting without the Celery worker.\n' "$YELLOW" "$RESET"
    printf '      Queued operations (provision / migrate / backup) will stay "pending".\n'
    printf '      Start Redis with:  brew services start redis   (or: docker run -p 6379:6379 redis)\n'
fi

# --- start --------------------------------------------------------------
log "starting next(:3000) controller(:8000) terminal(:8765)$([[ $REDIS_OK == 1 ]] && printf ' worker beat')"

run "next"       "$BLUE"    npx next dev
run "controller" "$GREEN"   bash -c "cd controller && source env/bin/activate && exec python main.py serve"
run "terminal"   "$MAGENTA" bash -c "cd controller && source env/bin/activate && exec python ws_terminal_main.py"
[[ $REDIS_OK == 1 ]] && run "worker" "$YELLOW" bash -c "cd controller && source env/bin/activate && exec python main.py worker"
# Beat is what fires the periodic jobs: scheduled site backups, the seat/storage audit and the health sweep.
# Exactly one scheduler may run, so it is started here and nowhere else.
[[ $REDIS_OK == 1 ]] && run "beat"   "$RED"    bash -c "cd controller && source env/bin/activate && exec python main.py beat"

log "Ctrl-C to stop all of them"
wait
