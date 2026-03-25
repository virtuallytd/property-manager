import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserRound, Home, Unlink } from 'lucide-react'
import toast from 'react-hot-toast'
import { listTenants, assignTenant, unassignTenant, TenantOut } from '../api/tenants'
import { listProperties } from '../api/properties'

function AssignModal({
  tenant,
  onClose,
}: {
  tenant: TenantOut
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | ''>('')

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: listProperties,
  })

  const assign = useMutation({
    mutationFn: (propertyId: number) => assignTenant(tenant.id, propertyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      toast.success('Tenant assigned')
      onClose()
    },
    onError: () => toast.error('Failed to assign tenant'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card w-full max-w-sm space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Assign {tenant.username} to a property
        </h2>

        <select
          className="input w-full"
          value={selectedPropertyId}
          onChange={e => setSelectedPropertyId(Number(e.target.value))}
        >
          <option value="">Select a property…</option>
          {properties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!selectedPropertyId || assign.isPending}
            onClick={() => selectedPropertyId && assign.mutate(Number(selectedPropertyId))}
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Tenants() {
  const qc = useQueryClient()
  const [assignTarget, setAssignTarget] = useState<TenantOut | null>(null)

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: listTenants,
  })

  const unassign = useMutation({
    mutationFn: (tenantId: number) => unassignTenant(tenantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      toast.success('Tenant unassigned')
    },
    onError: () => toast.error('Failed to unassign tenant'),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Tenants</h1>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : tenants.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center">
          <UserRound size={32} className="text-slate-300" />
          <p className="text-sm text-slate-500">No tenants yet. Ask your admin to create tenant accounts for you.</p>
        </div>
      ) : (
        <div className="card divide-y divide-slate-100 p-0 overflow-hidden">
          {tenants.map(tenant => (
            <div key={tenant.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-sm font-semibold">
                {tenant.username.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">@{tenant.username}</p>
                <p className="text-xs text-slate-500">{tenant.email}</p>
              </div>

              <div className="flex items-center gap-2">
                {tenant.current_property ? (
                  <>
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                      <Home size={11} />
                      {tenant.current_property.name}
                    </span>
                    <button
                      title="Unassign from property"
                      className="rounded p-1 text-slate-400 hover:text-red-500 transition-colors"
                      onClick={() => unassign.mutate(tenant.id)}
                    >
                      <Unlink size={14} />
                    </button>
                    <button
                      className="btn text-xs py-1 px-3"
                      onClick={() => setAssignTarget(tenant)}
                    >
                      Move
                    </button>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                      Unassigned
                    </span>
                    <button
                      className="btn btn-primary text-xs py-1 px-3"
                      onClick={() => setAssignTarget(tenant)}
                    >
                      Assign
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {assignTarget && (
        <AssignModal tenant={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
    </div>
  )
}
