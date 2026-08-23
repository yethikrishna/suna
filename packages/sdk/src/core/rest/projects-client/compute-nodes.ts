import { backendApi } from '../../http/api-client'
import { unwrap } from './shared'

export interface ComputeNodeDeviceAuth {
  device_code: string
  machine_hostname: string
  type: string
  expires_at: string
}

export interface ComputeNodeSummary {
  compute_node_id: string
  account_id: string
  project_id: string | null
  type: string
  status: string
  connected: boolean
  update_channel: string
  concurrency: number
  capabilities: string[]
}

export interface ApproveComputeNodeDeviceAuthInput {
  project_id?: string | null
  update_channel?: string
  concurrency?: number
}

export async function getComputeNodeDeviceAuth(accountId: string, code: string) {
  return unwrap(await backendApi.get<ComputeNodeDeviceAuth>(`/accounts/${encodeURIComponent(accountId)}/compute-nodes/device-auth/${encodeURIComponent(code)}`))
}

export async function approveComputeNodeDeviceAuth(accountId: string, code: string, input: ApproveComputeNodeDeviceAuthInput = {}) {
  return unwrap(await backendApi.post<ComputeNodeSummary>(`/accounts/${encodeURIComponent(accountId)}/compute-nodes/device-auth/${encodeURIComponent(code)}/approve`, input))
}

export async function denyComputeNodeDeviceAuth(accountId: string, code: string) {
  return unwrap(await backendApi.post<{ ok: true }>(`/accounts/${encodeURIComponent(accountId)}/compute-nodes/device-auth/${encodeURIComponent(code)}/deny`, {}))
}
