function quoteShell(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function buildSessionSupervisorCommand(
  relayUrl: string,
  identity?: { nodeId: string; nodeToken: string },
  assetApiUrl: string = relayUrl,
): string {
  const normalizedRelayUrl = `${relayUrl
    .replace(/\/+$/, '')
    .replace(/\/v1\/router$/, '')
    .replace(/\/v1$/, '')}/v1`;
  const identityEnv = identity
    ? ` KORTIX_COMPUTE_NODE_ID=${quoteShell(identity.nodeId)} KORTIX_NODE_TOKEN=${quoteShell(identity.nodeToken)}`
    : '';
  const stopOldProcesses = String.raw`for proc in /proc/[0-9]*; do [ -r "$proc/cmdline" ] || continue; cmd=$(tr '\0' ' ' < "$proc/cmdline" 2>/dev/null); cmd=${'${cmd% }'}; case "$cmd" in "/usr/local/bin/kortix-agent"|"/opt/kortix/agent.current run"|"/opt/kortix/agent.bootstrap supervise"|"/usr/local/bin/kortix-entrypoint"|"/bin/sh /usr/local/bin/kortix-entrypoint") kill -TERM "${'${proc#/proc/}'}" 2>/dev/null || true;; esac; done; sleep 1`;
  if (!identity) {
    return `${stopOldProcesses}; KORTIX_API_URL=${quoteShell(normalizedRelayUrl)} setsid -f /usr/local/bin/kortix-entrypoint >>/tmp/kortix-entrypoint.log 2>&1 </dev/null`;
  }
  const normalizedAssetApiUrl = `${assetApiUrl.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1`;
  const assetUrl = `${normalizedAssetApiUrl}/runtime-assets/agent`;
  const runtimePath = '/home/kortix/.local/bin:/home/kortix/.local/share/pnpm/bin:/home/kortix/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
  return `${stopOldProcesses}; install -d -o kortix -g kortix -m 0755 /opt/kortix /opt/kortix/node; tmp=/opt/kortix/agent.bootstrap.tmp; curl -fsSL --retry 3 --retry-delay 1 -H ${quoteShell(`Authorization: Bearer ${identity.nodeToken}`)} ${quoteShell(assetUrl)} -o "$tmp"; chmod 0755 "$tmp"; "$tmp" version >/dev/null; mv -f "$tmp" /opt/kortix/agent.bootstrap; chown kortix:kortix /opt/kortix/agent.bootstrap; ${identityEnv.trim()} KORTIX_API_URL=${quoteShell(normalizedRelayUrl)} KORTIXD_HOME=/opt/kortix/node HOME=${quoteShell('/home/kortix')} USER=kortix LOGNAME=kortix PATH=${quoteShell(runtimePath)} setsid -f setpriv --reuid kortix --regid kortix --init-groups /opt/kortix/agent.bootstrap supervise >>/tmp/kortix-entrypoint.log 2>&1 </dev/null`;
}
