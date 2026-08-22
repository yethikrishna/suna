import { beforeEach, expect, mock, test } from 'bun:test'
import { configureKortix } from '../../http/config'
import { approveComputeNodeDeviceAuth, denyComputeNodeDeviceAuth, getComputeNodeDeviceAuth } from './compute-nodes'

let calls: Array<{ url: string; method: string; body?: unknown }> = []

beforeEach(() => {
  calls = []
  globalThis.fetch = mock(async (url: unknown, options: RequestInit = {}) => {
    calls.push({ url: String(url), method: options.method ?? 'GET', ...(options.body ? { body: JSON.parse(String(options.body)) } : {}) })
    if (options.method === 'POST' && String(url).endsWith('/approve')) return Response.json({ compute_node_id: 'node-1', type: 'workstation', status: 'offline' }, { status: 201 })
    if (options.method === 'POST') return Response.json({ ok: true })
    return Response.json({ device_code: 'ABCD-1234', machine_hostname: 'Markos-Mac', type: 'workstation', expires_at: '2026-08-22T21:00:00.000Z' })
  }) as unknown as typeof fetch
})

configureKortix({ backendUrl: 'http://test.local/v1', getToken: async () => 'token' })

test('reads a pending compute-node device challenge through authenticated transport', async () => {
  expect(await getComputeNodeDeviceAuth('account-1', 'ABCD-1234')).toMatchObject({ machine_hostname: 'Markos-Mac', type: 'workstation' })
  expect(calls[0]).toMatchObject({ url: 'http://test.local/v1/accounts/account-1/compute-nodes/device-auth/ABCD-1234', method: 'GET' })
})

test('approves a compute-node device challenge with node policy', async () => {
  expect(await approveComputeNodeDeviceAuth('account-1', 'ABCD-1234', { project_id: null, update_channel: 'stable', concurrency: 1 })).toMatchObject({ compute_node_id: 'node-1', status: 'offline' })
  expect(calls[0]).toMatchObject({ method: 'POST', body: { project_id: null, update_channel: 'stable', concurrency: 1 } })
})

test('denies a compute-node device challenge', async () => {
  expect(await denyComputeNodeDeviceAuth('account-1', 'ABCD-1234')).toEqual({ ok: true })
  expect(calls[0]).toMatchObject({ method: 'POST', body: {} })
})
