/**
 * Chunk-boundary-safe find/replace over a BYTE STREAM.
 *
 * This is the kernel that lets the relay stop being a buffered JSON-RPC and
 * become a real egress proxy. Today `substituteBuffer` / `redactSecretFromResponse`
 * (http-broker.ts) call `buffer.indexOf` over a COMPLETE body, which forces the
 * whole request and the whole response to be held in memory — that is where the
 * 1 MiB / 5 MiB caps come from, and why nothing can stream.
 *
 * The problem a stream adds is that a needle can straddle a chunk boundary:
 *
 *     chunk 1: "...Authorization: Bearer kortix_brok"
 *     chunk 2: "ered__KXS1abc...  <rest of body>"
 *
 * A naive per-chunk replace misses that and ships the handle to the upstream.
 * The fix is to withhold, at each step, the last `maxNeedleLength - 1` bytes —
 * the longest tail that could still become a needle — and re-scan them joined to
 * the next chunk. That window is BOUNDED by the longest needle (a handle is ~60
 * bytes), so memory is O(needle), NOT O(body). That bound is the whole point:
 * it is what removes the size caps.
 *
 * Two invariants make this safe to reason about:
 *
 *  1. **Replacement bytes are never re-scanned.** The retained tail always
 *     starts at or after the end of the last completed replacement, so a secret
 *     value that happens to contain needle-shaped bytes cannot be rewritten a
 *     second time.
 *  2. **The output is byte-identical to the whole-buffer algorithm.** Whatever
 *     the chunking, `push(...)+flush()` concatenated equals replacing over the
 *     joined input. `stream-substitute.test.ts` fuzzes this against the
 *     non-streaming implementation, because "it works on my chunk sizes" is
 *     exactly the bug class this file exists to prevent.
 */

export interface StreamReplacement {
  /** The bytes to find — a handle (request side) or a secret value (response
   *  side, where the replacement is `[REDACTED]`). */
  needle: Buffer;
  replacement: Buffer;
  /** Reported through `applied` when this pair matches at least once, so the
   *  caller can audit WHICH secrets rode out on the wire. */
  label?: string;
}

export class StreamSubstituter {
  private readonly pairs: StreamReplacement[];
  private readonly window: number;
  private pending: Buffer = Buffer.alloc(0);
  private readonly hits = new Set<string>();
  private done = false;

  constructor(pairs: readonly StreamReplacement[]) {
    // A zero-length needle would match everywhere and never advance.
    this.pairs = pairs.filter((pair) => pair.needle.byteLength > 0);
    // Retain the longest needle's worth of bytes. Not `longest - 1`: a match is
    // only committed once EVERY needle would be fully visible from its start
    // position, otherwise a short needle that is a PREFIX of a longer one gets
    // committed first and shadows it (`abc` firing inside `abcdef`). Retaining
    // `longest` makes leftmost-longest decidable at commit time. Still O(needle),
    // not O(body) — which is what removes the size caps.
    this.window = this.pairs.reduce((max, pair) => Math.max(max, pair.needle.byteLength), 0);
  }

  /** Labels whose needle matched at least once so far. */
  get applied(): string[] {
    return [...this.hits];
  }

  /** True when nothing can ever match, so the caller may skip this stage
   *  entirely and pipe the socket straight through. */
  get isPassThrough(): boolean {
    return this.pairs.length === 0;
  }

  /**
   * Feed one chunk. Returns the bytes that are safe to forward NOW — which is
   * everything except a bounded tail that might still turn out to be the start
   * of a needle.
   */
  push(chunk: Buffer): Buffer {
    if (this.done) throw new Error('StreamSubstituter: push after flush');
    if (this.pairs.length === 0) return chunk;
    const work = this.pending.byteLength === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    // Only commit a match whose start position leaves room for the LONGEST
    // needle, so every candidate is fully visible and leftmost-longest is
    // decidable. Anything at or past this point waits for more bytes.
    const safeStart = work.byteLength - this.window;
    const { output, consumed } =
      safeStart >= 0 ? this.replaceComplete(work, safeStart) : { output: Buffer.alloc(0), consumed: 0 };
    // Everything after the last completed replacement is still original bytes,
    // so it is safe to re-scan on the next chunk.
    const keepFrom = Math.max(consumed, Math.max(0, safeStart));
    this.pending = work.subarray(keepFrom);
    return output.byteLength === 0 && keepFrom === consumed
      ? Buffer.alloc(0)
      : Buffer.concat([output, work.subarray(consumed, keepFrom)]);
  }

  /**
   * No more input. Returns the retained tail — at this point a partial needle is
   * just data, because nothing can complete it.
   */
  flush(): Buffer {
    if (this.done) return Buffer.alloc(0);
    this.done = true;
    if (this.pairs.length === 0 || this.pending.byteLength === 0) {
      const tail = this.pending;
      this.pending = Buffer.alloc(0);
      return tail;
    }
    // The tail can still contain a COMPLETE needle when the stream ended
    // mid-window, so it gets one final pass with NO commit limit — nothing more
    // is coming, so every match that exists is fully visible.
    const { output, consumed } = this.replaceComplete(this.pending, this.pending.byteLength);
    const rest = this.pending.subarray(consumed);
    this.pending = Buffer.alloc(0);
    return Buffer.concat([output, rest]);
  }

  /**
   * Replace every COMPLETE match starting at or before `maxStart`, leftmost-first.
   *
   * Returns the rewritten prefix and how far into `work` it consumed. Bytes
   * after `consumed` are untouched originals — never replacement output — which
   * is what makes retaining them for the next chunk safe.
   */
  private replaceComplete(work: Buffer, maxStart: number): { output: Buffer; consumed: number } {
    const chunks: Buffer[] = [];
    let cursor = 0;
    for (;;) {
      let bestIndex = -1;
      let bestPair: StreamReplacement | null = null;
      for (const pair of this.pairs) {
        const index = work.indexOf(pair.needle, cursor);
        if (index === -1 || index > maxStart) continue;
        // Leftmost wins; on a tie the longer needle wins so a needle that is a
        // prefix of another cannot shadow it.
        if (
          bestIndex === -1 ||
          index < bestIndex ||
          (index === bestIndex && pair.needle.byteLength > (bestPair?.needle.byteLength ?? 0))
        ) {
          bestIndex = index;
          bestPair = pair;
        }
      }
      if (bestIndex === -1 || !bestPair) break;
      chunks.push(work.subarray(cursor, bestIndex), bestPair.replacement);
      if (bestPair.label) this.hits.add(bestPair.label);
      cursor = bestIndex + bestPair.needle.byteLength;
    }
    return { output: chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0), consumed: cursor };
  }
}

/**
 * The whole-buffer equivalent, kept here as the ORACLE the streaming path is
 * fuzzed against. Callers with a complete buffer should keep using
 * `http-broker.ts`'s own helpers; this exists so the test can assert the two
 * agree for every chunking.
 */
export function substituteWholeBuffer(
  source: Buffer,
  pairs: readonly StreamReplacement[],
): Buffer {
  const substituter = new StreamSubstituter(pairs);
  const head = substituter.push(source);
  return Buffer.concat([head, substituter.flush()]);
}
