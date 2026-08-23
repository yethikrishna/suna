export function buildSessionSupervisorCommand(relayUrl: string): string {
  const normalizedRelayUrl = `${relayUrl
    .replace(/\/+$/, '')
    .replace(/\/v1\/router$/, '')
    .replace(/\/v1$/, '')}/v1`;
  const quotedRelayUrl = `'${normalizedRelayUrl.replace(/'/g, `'"'"'`)}'`;
  return String.raw`for proc in /proc/[0-9]*; do [ -r "$proc/cmdline" ] || continue; cmd=$(tr '\0' ' ' < "$proc/cmdline" 2>/dev/null); cmd=${'${cmd% }'}; case "$cmd" in "/usr/local/bin/kortix-agent"|"/opt/kortix/agent.current run"|"/usr/local/bin/kortix-entrypoint"|"/bin/sh /usr/local/bin/kortix-entrypoint") kill -TERM "${'${proc#/proc/}'}" 2>/dev/null || true;; esac; done; sleep 1; KORTIX_API_URL=` + quotedRelayUrl + String.raw` setsid -f /usr/local/bin/kortix-entrypoint >>/tmp/kortix-entrypoint.log 2>&1 </dev/null`;
}
