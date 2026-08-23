export const WEBSOCKET_HEARTBEAT_INTERVAL_MS = 30_000;

type IntervalFactory = (
  callback: () => void,
  intervalMs: number,
) => ReturnType<typeof setInterval>;

/** Keep an otherwise-idle WebSocket alive across edge proxies. */
export function startWebSocketHeartbeat(
  socket: { ping(): unknown },
  setIntervalFn: IntervalFactory = setInterval,
  clearIntervalFn: (timer: ReturnType<typeof setInterval>) => void = clearInterval,
): () => void {
  const timer = setIntervalFn(() => {
    try { socket.ping(); } catch {}
  }, WEBSOCKET_HEARTBEAT_INTERVAL_MS);
  timer.unref?.();
  return () => clearIntervalFn(timer);
}
