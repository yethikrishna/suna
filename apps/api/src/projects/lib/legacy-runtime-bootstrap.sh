#!/bin/bash
# Kortix legacy runtime bootstrap. Installs the supervising entrypoint and
# stages the current kortix-agent on a box whose daemon predates convergence.
# Rendered by apps/api/src/projects/lib/legacy-runtime-bootstrap.ts (placeholders below).
set -uo pipefail
STATE_DIR=/opt/kortix
ENTRYPOINT=/usr/local/bin/kortix-entrypoint
OPENCODE_HOME='__OPENCODE_HOME__'
RELAUNCH='__RELAUNCH__'
HEALTH_WAIT_S=__HEALTH_WAIT_S__
# Entrypoint supplied by the control plane, for an API whose manifest predates the
# `entrypoint` asset. Empty when the box's API serves it (preferred: same digest chain).
EMBEDDED_EP_B64='__ENTRYPOINT_B64__'
LOG=/var/log/kortix-legacy-bootstrap.log
log() { printf '[legacy-bootstrap] %s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG" >&2; }
emit() { printf '%s\n' "$1"; }
fail() {
  local msg; msg=$(printf '%s' "$2" | tr -d '"\\' | tr '\n' ' ')
  log "FAIL $1: $msg"
  emit "{\"ok\":false,\"stage\":\"$1\",\"error\":\"$msg\"}"
  exit 1
}
# Read one variable with NO shell evaluation: process env, then /etc/environment
# (written by pt-init from the provision-time env), then the legacy daemon's own
# environment. Values are only ever assigned, never expanded.
readenv() {
  local k="$1" v=""
  v="${!k:-}"
  if [ -z "$v" ] && [ -f /etc/environment ]; then
    v=$(grep -m1 "^${k}=" /etc/environment | cut -d= -f2-)
  fi
  if [ -z "$v" ]; then
    local p; p=$(pgrep -x kortix-agent | head -1 || true)
    if [ -n "$p" ] && [ -r "/proc/$p/environ" ]; then
      v=$(tr '\0' '\n' < "/proc/$p/environ" | grep -m1 "^${k}=" | cut -d= -f2-)
    fi
  fi
  printf '%s' "$v"
}
[ "$(id -u)" = 0 ] || fail preflight "must run as root"
for b in curl sha256sum setsid pgrep; do
  command -v "$b" >/dev/null 2>&1 || fail preflight "missing $b"
done
mkdir -p "$STATE_DIR" 2>/dev/null || fail preflight "cannot create $STATE_DIR"
API=$(readenv KORTIX_API_URL); API="${API%/}"; API="${API%/v1}"
TOKEN=$(readenv KORTIX_SANDBOX_TOKEN); [ -n "$TOKEN" ] || TOKEN=$(readenv KORTIX_TOKEN)
[ -n "$API" ] || fail preflight "KORTIX_API_URL is not set on this box"
[ -n "$TOKEN" ] || fail preflight "no sandbox token on this box"
free_mb=$(df -Pm "$STATE_DIR" 2>/dev/null | awk 'NR==2{print $4}')
[ "${free_mb:-0}" -ge 400 ] || fail preflight "only ${free_mb:-0} MB free under $STATE_DIR"
MAN=$(curl -fsS --max-time 30 -H "Authorization: Bearer $TOKEN" "$API/v1/runtime-assets/manifest") \
  || fail manifest "manifest fetch from $API failed"
field() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$MAN" | python3 -c 'import json,sys
m=json.load(sys.stdin); c=(m.get("components") or {}).get(sys.argv[1]) or {}
v=c.get(sys.argv[2]); print("" if v is None else v)' "$1" "$2"
  else
    printf '%s' "$MAN" | tr -d '\n ' | sed -n "s/.*\"$1\":{[^}]*\"$2\":\"\{0,1\}\([^\",}]*\)\"\{0,1\}.*/\1/p"
  fi
}
AGENT_SHA=$(field agent sha256); AGENT_PATH=$(field agent path); AGENT_VER=$(field agent version)
EP_SHA=$(field entrypoint sha256); EP_PATH=$(field entrypoint path)
BUILD=$(printf '%s' "$MAN" | tr -d '\n ' | sed -n 's/.*"build":\([0-9]*\).*/\1/p')
[ -n "$AGENT_SHA" ] && [ -n "$AGENT_PATH" ] || fail manifest "manifest has no agent component"
EP_SOURCE=manifest
if [ -z "$EP_SHA" ] || [ -z "$EP_PATH" ]; then
  [ -n "$EMBEDDED_EP_B64" ] || fail manifest "manifest has no entrypoint component and none was embedded"
  EP_SOURCE=embedded
fi
download() {
  local tmp="$3.tmp.$$"; rm -f "$tmp"
  curl -fsSL --max-time 240 --retry 2 -H "Authorization: Bearer $TOKEN" -o "$tmp" "$API$1" \
    || { rm -f "$tmp"; log "download of $1 failed"; return 1; }
  local got; got=$(sha256sum "$tmp" | cut -d' ' -f1)
  if [ "$got" != "$2" ]; then rm -f "$tmp"; log "digest mismatch for $1: want $2 got $got"; return 1; fi
  mv -f "$tmp" "$3"
}
# 1. Agent: staged for the supervisor. The baked binary is never written.
if [ -f "$STATE_DIR/agent.current" ] \
   && [ "$(sha256sum "$STATE_DIR/agent.current" | cut -d' ' -f1)" = "$AGENT_SHA" ]; then
  log "agent.current already at $AGENT_SHA"
else
  download "$AGENT_PATH" "$AGENT_SHA" "$STATE_DIR/agent.next" || fail agent "agent download failed"
  chmod 0755 "$STATE_DIR/agent.next"
  printf '%s\n' "$AGENT_SHA" > "$STATE_DIR/agent.next.sha256"
  rm -f "$STATE_DIR/agent.pinned"
fi
# 2. Entrypoint: verified, syntax-checked, installed atomically; legacy copy kept once.
if [ "$EP_SOURCE" = embedded ]; then
  printf '%s' "$EMBEDDED_EP_B64" | base64 -d > "$ENTRYPOINT.next" 2>/dev/null || fail entrypoint "embedded entrypoint failed to decode"
  EP_SHA=$(sha256sum "$ENTRYPOINT.next" | cut -d' ' -f1)
else
  download "$EP_PATH" "$EP_SHA" "$ENTRYPOINT.next" || fail entrypoint "entrypoint download failed"
fi
bash -n "$ENTRYPOINT.next" || fail entrypoint "downloaded entrypoint fails bash -n"
chmod 0755 "$ENTRYPOINT.next"
if [ -f "$ENTRYPOINT" ] && [ ! -f "$ENTRYPOINT.legacy" ]; then cp -p "$ENTRYPOINT" "$ENTRYPOINT.legacy"; fi
mv -f "$ENTRYPOINT.next" "$ENTRYPOINT"
# 3. HOME shim: the current daemon derives OpenCode's home from $HOME. Keep the
#    existing transcript database reachable from either path.
if [ -d "$OPENCODE_HOME" ] && [ ! -e /home/kortix ]; then
  mkdir -p /home && ln -s "$OPENCODE_HOME" /home/kortix
fi
PREV_OC=$(/usr/local/bin/opencode --version 2>/dev/null | head -1 | tr -d '"\\' || true)
printf '{"at":"%s","agent_sha256":"%s","agent_version":"%s","entrypoint_sha256":"%s","manifest_build":"%s","previous_opencode":"%s"}\n' \
  "$(date -u +%FT%TZ)" "$AGENT_SHA" "$AGENT_VER" "$EP_SHA" "$BUILD" "$PREV_OC" > "$STATE_DIR/legacy-bootstrap.json"
log "staged agent $AGENT_VER ($AGENT_SHA) and entrypoint $EP_SHA from $EP_SOURCE (previous opencode: $PREV_OC)"
if [ "$RELAUNCH" != "pt-app" ]; then
  emit "{\"ok\":true,\"stage\":\"staged\",\"agent_sha256\":\"$AGENT_SHA\",\"entrypoint_sha256\":\"$EP_SHA\",\"previous_opencode\":\"$PREV_OC\"}"
  exit 0
fi
# 4. Relaunch in place. pt-init started /sbin/pt-app once and never respawns it.
[ -x /sbin/pt-app ] || fail relaunch "/sbin/pt-app is missing"
old_agent=$(pgrep -x kortix-agent || true)
old_sh=$(pgrep -f '^sh -c /usr/local/bin/kortix-entrypoint' || true)
old_oc=$(pgrep -f 'opencode serve' || true)
for p in $old_sh $old_agent; do kill -TERM "$p" 2>/dev/null || true; done
for i in $(seq 1 20); do pgrep -x kortix-agent >/dev/null 2>&1 || break; sleep 0.5; done
for p in $old_agent $old_oc; do kill -KILL "$p" 2>/dev/null || true; done
sleep 1
HOME="$OPENCODE_HOME" setsid nohup /sbin/pt-app </dev/null >>/var/log/pt-app.log 2>&1 &
disown 2>/dev/null || true
ok=0
for i in $(seq 1 "$HEALTH_WAIT_S"); do
  h=$(curl -fsS --max-time 3 http://127.0.0.1:8000/kortix/health 2>/dev/null || true)
  case "$h" in *'"runtime"'*) ok=1; break ;; esac
  sleep 1
done
if [ "$ok" != 1 ]; then
  log "relaunched daemon did not answer within ${HEALTH_WAIT_S}s; restoring the legacy chain"
  [ -f "$ENTRYPOINT.legacy" ] && cp -p "$ENTRYPOINT.legacy" "$ENTRYPOINT"
  rm -f "$STATE_DIR/agent.next" "$STATE_DIR/agent.next.sha256" "$STATE_DIR/agent.current"
  pkill -x kortix-agent 2>/dev/null || true
  pkill -f 'opencode serve' 2>/dev/null || true
  sleep 1
  HOME=/ setsid nohup /sbin/pt-app </dev/null >>/var/log/pt-app.log 2>&1 &
  disown 2>/dev/null || true
  fail relaunch "new daemon health timeout after ${HEALTH_WAIT_S}s"
fi
log "relaunched: daemon reports a runtime block"
emit "{\"ok\":true,\"stage\":\"relaunched\",\"agent_sha256\":\"$AGENT_SHA\",\"entrypoint_sha256\":\"$EP_SHA\",\"previous_opencode\":\"$PREV_OC\"}"
