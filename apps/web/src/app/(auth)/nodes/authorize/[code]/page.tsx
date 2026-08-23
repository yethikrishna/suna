'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { approveComputeNodeDeviceAuth, denyComputeNodeDeviceAuth, getComputeNodeDeviceAuth, listAccounts } from '@kortix/sdk'
import { useParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import Loading from '@/components/ui/loading'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AuthFrame } from '@/features/auth/auth-card-shell'
import { AuthPendingScreen, AuthStatusScreen } from '@/features/auth/auth-consent'
import { FieldLabel, Rise, StepHeader } from '@/features/auth/auth-primitives'
import { useAuth } from '@/features/providers/auth-provider'
import { useCurrentAccountStore } from '@/stores/current-account-store'

export default function ComputeNodeAuthorizePage() {
  return <Suspense fallback={<AuthPendingScreen />}><ComputeNodeAuthorize /></Suspense>
}

function ComputeNodeAuthorize() {
  const code = String(useParams().code ?? '')
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const selectedAccountId = useCurrentAccountStore((state) => state.selectedAccountId)
  const setSelectedAccountId = useCurrentAccountStore((state) => state.setSelectedAccountId)
  const [done, setDone] = useState<'approved' | 'denied' | null>(null)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/auth?returnUrl=${encodeURIComponent(`/nodes/authorize/${code}`)}`)
  }, [authLoading, code, router, user])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])

  const accounts = useQuery({ queryKey: ['accounts'], queryFn: listAccounts, staleTime: 60_000, enabled: Boolean(user) })
  const accountId = accounts.data?.some((account) => account.account_id === selectedAccountId) ? selectedAccountId! : accounts.data?.[0]?.account_id
  useEffect(() => { if (accountId && accountId !== selectedAccountId) setSelectedAccountId(accountId) }, [accountId, selectedAccountId, setSelectedAccountId])
  const request = useQuery({
    queryKey: ['compute-node-device-auth', accountId, code],
    queryFn: () => getComputeNodeDeviceAuth(accountId!, code),
    enabled: Boolean(accountId && code && user),
    retry: false,
  })
  const approve = useMutation({ mutationFn: () => approveComputeNodeDeviceAuth(accountId!, code, { update_channel: 'stable', concurrency: 1 }), onSuccess: () => setDone('approved') })
  const deny = useMutation({ mutationFn: () => denyComputeNodeDeviceAuth(accountId!, code), onSuccess: () => setDone('denied') })
  const remaining = useMemo(() => request.data ? (now === null ? 300 : Math.max(0, Math.floor((Date.parse(request.data.expires_at) - now) / 1_000))) : 0, [now, request.data])

  if (authLoading || (user && accounts.isLoading) || (accountId && request.isLoading)) return <AuthPendingScreen />
  if (!user) return <AuthPendingScreen />
  if (!accounts.data?.length) return <AuthStatusScreen title="No account available" description="Create or join an account before authorizing this compute node." />
  if (request.error || !request.data) return <AuthStatusScreen title="Request not found" description="This node authorization request is invalid, expired, or already resolved." />
  if (done) return <AuthStatusScreen title={done === 'approved' ? 'Compute node authorized' : 'Request denied'} description={done === 'approved' ? 'kortixd is completing enrollment. You can close this tab.' : 'The compute node was not enrolled.'} />
  if (remaining <= 0) return <AuthStatusScreen title="Request expired" description="Run kortixd connect again to create a new device code." />

  const busy = approve.isPending || deny.isPending
  return (
    <AuthFrame>
      <Rise><StepHeader title="Authorize compute node" description="Confirm that this code matches the code printed by kortixd." /></Rise>
      <Rise delay={0.06}>
        <div className="space-y-5">
          <div className="bg-popover flex items-center justify-between gap-3 rounded-md border px-4 py-3">
            <span className="text-foreground font-mono text-lg font-medium tracking-[0.15em] tabular-nums">{request.data.device_code}</span>
            <span className="text-muted-foreground font-mono text-xs tabular-nums">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>
          </div>
          <div className="bg-popover space-y-3 rounded-md border px-4 py-5">
            <div><p className="text-sm font-medium">{request.data.machine_hostname}</p><p className="text-muted-foreground text-xs">{request.data.type} compute node</p></div>
            <div className="space-y-2">
              <FieldLabel htmlFor="compute-node-account">Account</FieldLabel>
              <Select value={accountId} onValueChange={setSelectedAccountId} disabled={busy}>
                <SelectTrigger id="compute-node-account" variant="outline" size="md" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{accounts.data.map((account) => <SelectItem key={account.account_id} value={account.account_id}>{account.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground text-xs text-pretty">This installs a node-only credential. It does not grant user, account, project, or billing authority to this computer.</p>
          </div>
          <div className="space-y-3">
            <Button size="lg" className="w-full active:scale-[0.96] transition-transform" disabled={busy} onClick={() => approve.mutate()}>{approve.isPending ? <Loading className="size-4 shrink-0" /> : null}Authorize node</Button>
            <Button variant="outline" size="lg" className="w-full active:scale-[0.96] transition-transform" disabled={busy} onClick={() => deny.mutate()}>{deny.isPending ? <Loading className="size-4 shrink-0" /> : null}Deny request</Button>
          </div>
        </div>
      </Rise>
    </AuthFrame>
  )
}
