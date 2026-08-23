function quoteShell(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function buildSessionSupervisorCommand(
  relayUrl: string,
  identity?: { nodeId: string; nodeToken: string },
): string {
  const normalizedRelayUrl = `${relayUrl
    .replace(/\/+$/, '')
    .replace(/\/v1\/router$/, '')
    .replace(/\/v1$/, '')}/v1`;
  const identityEnv = identity
    ? ` KORTIX_COMPUTE_NODE_ID=${quoteShell(identity.nodeId)} KORTIX_NODE_TOKEN=${quoteShell(identity.nodeToken)}`
    : '';
  return String.raw`for proc in /proc/[0-9]*; do [ -r "$proc/cmdline" ] || continue; cmd=$(tr '\0' ' ' < "$proc/cmdline" 2>/dev/null); cmd=${'${cmd% }'}; case "$cmd" in "/usr/local/bin/kortix-agent"|"/opt/kortix/agent.current run"|"/usr/local/bin/kortix-entrypoint"|"/bin/sh /usr/local/bin/kortix-entrypoint") kill -TERM "${'${proc#/proc/}'}" 2>/dev/null || true;; esac; done; sleep 1; KORTIX_API_URL=` + quoteShell(normalizedRelayUrl) + identityEnv + String.raw` setsid -f /usr/local/bin/kortix-entrypoint >>/tmp/kortix-entrypoint.log 2>&1 </dev/null`;
}
