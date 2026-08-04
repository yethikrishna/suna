/**
 * A spawn that FAILS must schedule a respawn. Nothing else recovers it.
 *
 * The supervisor's whole recovery story hangs off the child's `exit` event. A
 * failed spawn produces no child, so no exit ever fires and that path never
 * runs. `start()` logged the error and carried on, which is survivable at BOOT
 * — nothing was running yet — and fatal on a RESTART, because `restart()` stops
 * the working opencode first.
 *
 * So a restart whose spawn failed (a full disk, a PID or memory ceiling) killed
 * a healthy session permanently: `/kortix/health` reported `starting` with
 * `opencode_pid: null` forever, every prompt 503'd, and the readiness probe just
 * re-marked `starting` on a loop. Meanwhile `/kortix/env` had answered
 * `ok: true` and the reload reported success — so nothing anywhere said the
 * restart was what killed it, and the only escape was a new session.
 *
 * The recovery already existed for crashes: `scheduleUnplannedRespawn` retries
 * with backoff to 30s and re-schedules itself on repeated failure. The planned
 * path simply never called it.
 *
 * Asserted against the source. `spawnChild` and `scheduleUnplannedRespawn` are
 * closure-private, there is no seam to inject a failing spawn, and the honest
 * alternative — spawning a real 129MB opencode and filling a disk — is not a
 * unit test. This pins the wiring; the backoff behaviour it delegates to is
 * covered by its own comments and the exit path that has always used it.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(import.meta.dir, '..', 'opencode.ts'), 'utf8')

/** The body of the `start()` method on the returned supervisor. */
function startBody(): string {
  const body = SRC.split('async start() {')[1]?.split('\n    },')[0]
  expect(body).toBeTruthy()
  // Guard the extraction: if this stops covering the spawn, every assertion
  // below passes vacuously.
  expect(body).toContain('await spawnChild(bin)')
  return body as string
}

describe('start(): a failed spawn schedules a respawn', () => {
  test('the catch calls scheduleUnplannedRespawn, not just a log', () => {
    const body = startBody()
    const caught = body.slice(body.indexOf('} catch (err) {'))
    expect(caught).toContain('scheduleUnplannedRespawn()')
  })

  test('it marks the runtime down rather than leaving it "starting"', () => {
    // The readiness probe re-marks `starting` on every tick, so without this the
    // box reports a boot that is never going to finish.
    const body = startBody()
    const caught = body.slice(body.indexOf('} catch (err) {'))
    expect(caught).toContain("state = 'down'")
  })

  test('the recovery it uses re-schedules itself, so one failure is not terminal', () => {
    // The property that makes this a fix rather than a single extra attempt.
    const respawn = SRC.split('function scheduleUnplannedRespawn(): void {')[1]?.split('\n  }\n')[0]
    expect(respawn).toBeTruthy()
    expect(respawn).toContain('scheduleUnplannedRespawn()')
    expect(respawn).toContain('Math.min(restartDelayMs * 2, 30_000)')
  })

  test('it still refuses to fight a deliberate shutdown', () => {
    // `stop()` sets `stopping`; a respawn loop that ignored it would resurrect
    // opencode during shutdown and hang the container.
    const respawn = SRC.split('function scheduleUnplannedRespawn(): void {')[1]?.split('\n  }\n')[0]
    expect(respawn).toContain('if (stopping) return')
  })

  test('the successful path resets the backoff', () => {
    // Otherwise a session that recovered from one blip would carry a 30s delay
    // into its next restart for the rest of its life.
    expect(SRC).toContain('restartDelayMs = 500')
  })
})
