import { useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Archive, ArrowLeft, Building2, Calendar, CalendarClock, Check, Copy, FileText, Link, MapPin,
  Pencil, Plus, Trash2, Upload, UserMinus, X,
} from 'lucide-react'
import { getProperty } from '../api/properties'
import {
  type Tenancy,
  createInvite,
  listInvites,
  listTenancies,
  removeTenancy,
  revokeInvite,
  updateTenancy,
} from '../api/tenancies'
import { createTicket } from '../api/tickets'
import { listDocuments, uploadDocument, updateDocument, deleteDocument, DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES, type DocumentType, type PropertyDocument } from '../api/documents'
import { AuthContext } from '../contexts/AuthContext'
import PageHeader from '../components/PageHeader'

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({ propertyId, onClose }: { propertyId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [expiresAt, setExpiresAt] = useState('')
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: () => createInvite(propertyId, new Date(expiresAt).toISOString()),
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: ['invites', propertyId] })
      const link = `${window.location.origin}/invite/${invite.token}`
      setGeneratedLink(link)
    },
    onError: () => toast.error('Failed to generate invite link'),
  })

  const copy = () => {
    if (!generatedLink) return
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Invite Tenant</h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!generatedLink ? (
            <>
              <p className="text-sm text-slate-500">
                Set an expiry date for the invite link. The link can only be used once.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Link expires on</label>
                <input
                  type="date"
                  className="input w-full"
                  min={minDateStr}
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500">Share this link with your tenant. It expires on <span className="font-medium text-slate-700">{new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>.</p>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Link size={14} className="text-slate-400 shrink-0" />
                <span className="text-xs text-slate-600 truncate flex-1">{generatedLink}</span>
                <button onClick={copy} className="btn p-1.5 shrink-0">
                  {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button className="btn" onClick={onClose}>{generatedLink ? 'Done' : 'Cancel'}</button>
          {!generatedLink && (
            <button
              className="btn-primary"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !expiresAt}
            >
              {mutation.isPending ? 'Generating…' : 'Generate Link'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Schedule visit modal ─────────────────────────────────────────────────────

function ScheduleVisitModal({
  propertyId,
  tenancies,
  onClose,
}: {
  propertyId: number
  tenancies: Tenancy[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [proposedDate, setProposedDate] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<number>>(
    new Set(tenancies.map(t => t.tenant.id))
  )

  const toggleTenant = (id: number) =>
    setSelectedTenantIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async () => {
    if (!proposedDate || selectedTenantIds.size === 0) return
    setIsPending(true)
    try {
      await Promise.all(
        [...selectedTenantIds].map(tenantId =>
          createTicket({
            property_id: propertyId,
            title: title || 'Visit request',
            description: description || undefined,
            ticket_type: 'visit_request',
            proposed_date: new Date(proposedDate).toISOString(),
            tenant_id: tenantId,
          })
        )
      )
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['tickets-unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] })
      toast.success(
        selectedTenantIds.size === 1
          ? 'Visit request sent'
          : `Visit requests sent to ${selectedTenantIds.size} tenants`
      )
      onClose()
    } catch {
      toast.error('Failed to schedule visit')
    } finally {
      setIsPending(false)
    }
  }

  const minDateStr = new Date(Date.now() + 86400000).toISOString().slice(0, 16)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Schedule a Visit</h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              className="input w-full"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Annual inspection"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Proposed date &amp; time</label>
            <input
              type="datetime-local"
              className="input w-full"
              min={minDateStr}
              value={proposedDate}
              onChange={e => setProposedDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              className="input w-full resize-none"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any details for the tenant…"
            />
          </div>

          {tenancies.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Notify tenants</label>
              <div className="space-y-2">
                {tenancies.map(t => (
                  <label key={t.tenant.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      checked={selectedTenantIds.has(t.tenant.id)}
                      onChange={() => toggleTenant(t.tenant.id)}
                    />
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-violet-100 flex items-center justify-center text-xs font-semibold text-violet-700 overflow-hidden">
                        {t.tenant.avatar_url
                          ? <img src={t.tenant.avatar_url} alt="" className="h-full w-full object-cover" />
                          : t.tenant.username.charAt(0).toUpperCase()
                        }
                      </div>
                      <span className="text-sm text-slate-700">@{t.tenant.username}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isPending || !proposedDate || selectedTenantIds.size === 0}
          >
            {isPending ? 'Sending…' : `Send to ${selectedTenantIds.size} ${selectedTenantIds.size === 1 ? 'tenant' : 'tenants'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tenancy row ──────────────────────────────────────────────────────────────

function TenancyRow({ tenancy, propertyId }: { tenancy: Tenancy; propertyId: number }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [startDate, setStartDate] = useState(tenancy.start_date ?? '')
  const [endDate, setEndDate] = useState(tenancy.end_date ?? '')
  const [notes, setNotes] = useState(tenancy.notes ?? '')

  const updateMutation = useMutation({
    mutationFn: () => updateTenancy(propertyId, tenancy.id, {
      start_date: startDate || null,
      end_date: endDate || null,
      notes: notes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenancies', propertyId] })
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      toast.success('Tenancy updated')
      setEditing(false)
    },
    onError: () => toast.error('Failed to update tenancy'),
  })

  const removeMutation = useMutation({
    mutationFn: () => removeTenancy(propertyId, tenancy.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenancies', propertyId] })
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      toast.success('Tenant removed')
    },
    onError: () => toast.error('Failed to remove tenant'),
  })

  const handleRemove = () => {
    if (!window.confirm(`Remove @${tenancy.tenant.username} from this property?`)) return
    removeMutation.mutate()
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-sm font-semibold overflow-hidden">
            {tenancy.tenant.avatar_url
              ? <img src={tenancy.tenant.avatar_url} alt="" className="h-full w-full object-cover" />
              : tenancy.tenant.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">@{tenancy.tenant.username}</p>
            <p className="text-xs text-slate-500">{tenancy.tenant.email}</p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setEditing(e => !e)}
            className="btn p-1.5"
            title={editing ? 'Cancel' : 'Edit dates'}
          >
            {editing ? <X size={14} /> : <Calendar size={14} />}
          </button>
          <button onClick={handleRemove} className="btn p-1.5 text-red-500 hover:bg-red-50 hover:border-red-200" title="Remove tenant">
            <UserMinus size={14} />
          </button>
        </div>
      </div>

      {!editing && (tenancy.start_date || tenancy.end_date) && (
        <div className="flex gap-4 text-xs text-slate-500 border-t border-slate-100 pt-2">
          {tenancy.start_date && <span>From: <span className="text-slate-700">{new Date(tenancy.start_date).toLocaleDateString('en-GB')}</span></span>}
          {tenancy.end_date && <span>To: <span className="text-slate-700">{new Date(tenancy.end_date).toLocaleDateString('en-GB')}</span></span>}
        </div>
      )}

      {editing && (
        <div className="border-t border-slate-100 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
              <input type="date" className="input w-full text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End date</label>
              <input type="date" className="input w-full text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea className="input w-full resize-none text-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary text-xs py-1.5" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Expiry badge ──────────────────────────────────────────────────────────────

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null
  const now = new Date()
  const expiry = new Date(expiresAt)
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysLeft < 0) {
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Expired</span>
  }
  if (daysLeft <= 30) {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Expires in {daysLeft}d</span>
  }
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Expires {expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
}

// ─── Document row ─────────────────────────────────────────────────────────────

function DocumentRow({ doc, propertyId, canEdit }: { doc: PropertyDocument; propertyId: number; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(doc.display_name)
  const [editExpiry, setEditExpiry] = useState(doc.expires_at ? doc.expires_at.split('T')[0] : '')

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateDocument>[2]) => updateDocument(propertyId, doc.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', propertyId] })
      setEditing(false)
    },
    onError: () => toast.error('Failed to update document'),
  })

  const handleSave = () => {
    updateMutation.mutate({
      display_name: editName.trim() || undefined,
      expires_at: editExpiry || undefined,
      clear_expiry: !editExpiry,
    })
  }

  const handleArchiveToggle = () => {
    updateMutation.mutate({ is_archived: !doc.is_archived })
  }

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(propertyId, doc.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', propertyId] })
      toast.success('Document deleted')
    },
    onError: () => toast.error('Failed to delete document'),
  })

  return (
    <div className={`card px-4 py-3 space-y-2 ${doc.is_archived ? 'opacity-60' : ''}`}>
      {editing ? (
        <div className="space-y-2">
          <input
            className="input w-full text-sm"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Document name"
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input flex-1 text-sm"
              value={editExpiry}
              onChange={e => setEditExpiry(e.target.value)}
            />
            {editExpiry && (
              <button type="button" className="text-xs text-slate-400 hover:text-slate-600" onClick={() => setEditExpiry('')}>
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button className="btn text-xs py-1" onClick={() => { setEditing(false); setEditName(doc.display_name); setEditExpiry(doc.expires_at ? doc.expires_at.split('T')[0] : '') }}>Cancel</button>
            <button className="btn btn-primary text-xs py-1" onClick={handleSave} disabled={updateMutation.isPending || !editName.trim()}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <FileText size={16} className="text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${doc.is_archived ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
              {doc.display_name}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {DOCUMENT_TYPE_LABELS[doc.document_type]} · {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          {!doc.is_archived && <ExpiryBadge expiresAt={doc.expires_at} />}
          {doc.is_archived && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">Archived</span>}
          <div className="flex items-center gap-1 shrink-0">
            <a href={doc.url} target="_blank" rel="noreferrer" className="btn p-1.5" title="View / Download">
              <FileText size={14} />
            </a>
            {canEdit && (
              <>
                <button className="btn p-1.5" title="Edit" onClick={() => setEditing(true)}>
                  <Pencil size={14} />
                </button>
                <button
                  className={`btn p-1.5 ${doc.is_archived ? 'text-violet-500 hover:bg-violet-50 hover:border-violet-200' : 'text-amber-500 hover:bg-amber-50 hover:border-amber-200'}`}
                  title={doc.is_archived ? 'Unarchive' : 'Archive'}
                  onClick={handleArchiveToggle}
                  disabled={updateMutation.isPending}
                >
                  <Archive size={14} />
                </button>
                <button
                  className="btn p-1.5 text-red-500 hover:bg-red-50 hover:border-red-200"
                  title="Delete"
                  onClick={() => { if (window.confirm(`Delete "${doc.display_name}"?\n\nThis cannot be undone.`)) deleteMutation.mutate() }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Upload document modal ─────────────────────────────────────────────────────

function UploadDocumentModal({ propertyId, onClose }: { propertyId: number; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [docType, setDocType] = useState<DocumentType>('gas_safety')
  const [displayName, setDisplayName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const mutation = useMutation({
    mutationFn: () => uploadDocument(propertyId, docType, displayName, file!, expiresAt || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', propertyId] })
      toast.success('Document uploaded')
      onClose()
    },
    onError: () => toast.error('Failed to upload document'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Upload Document</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Document type</label>
            <select className="input w-full" value={docType} onChange={e => setDocType(e.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map(t => (
                <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Display name</label>
            <input
              className="input w-full"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Gas Safety Certificate 2025"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Expiry date <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="date"
              className="input w-full"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">File</label>
            {file ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">{file.name}</span>
                </div>
                <button type="button" onClick={() => setFile(null)} className="ml-2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors">
                <Upload size={15} />
                Choose file…
                <input type="file" className="hidden" onChange={e => { const picked = e.target.files?.[0]; e.target.value = ''; if (picked) setFile(picked) }} />
              </label>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !file || !displayName.trim()}
          >
            {mutation.isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>()
  const propertyId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useContext(AuthContext)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [uploadDocModalOpen, setUploadDocModalOpen] = useState(false)

  const { data: property, isLoading: propLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => getProperty(propertyId),
  })

  const { data: tenancies = [] } = useQuery({
    queryKey: ['tenancies', propertyId],
    queryFn: () => listTenancies(propertyId),
  })

  const { data: invites = [] } = useQuery({
    queryKey: ['invites', propertyId],
    queryFn: () => listInvites(propertyId),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', propertyId],
    queryFn: () => listDocuments(propertyId),
  })

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: number) => revokeInvite(propertyId, inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', propertyId] })
      toast.success('Invite revoked')
    },
    onError: () => toast.error('Failed to revoke invite'),
  })

  if (propLoading) return <div className="p-8 text-sm text-slate-500">Loading…</div>
  if (!property) return <div className="p-8 text-sm text-slate-500">Property not found.</div>

  const PROPERTY_TYPE_LABELS: Record<string, string> = { flat: 'Flat', house: 'House', hmo: 'HMO' }
  const PROPERTY_TYPE_COLOURS: Record<string, string> = {
    flat: 'bg-blue-100 text-blue-700',
    house: 'bg-green-100 text-green-700',
    hmo: 'bg-violet-100 text-violet-700',
  }

  // ── Tenant view ──────────────────────────────────────────────────────────────
  if (user?.role === 'tenant') {
    return (
      <div>
        <div className="px-8 pt-6">
          <button
            onClick={() => navigate('/properties')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={15} />
            My Properties
          </button>
        </div>
        <div className="p-8 space-y-8 max-w-3xl">
          {/* Property info */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                <Building2 size={20} className="text-slate-500" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900">{property.name}</h1>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PROPERTY_TYPE_COLOURS[property.property_type]}`}>
                  {PROPERTY_TYPE_LABELS[property.property_type]}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-1.5 text-sm text-slate-600">
              <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
              <span>{property.address_line1}{property.address_line2 ? `, ${property.address_line2}` : ''}, {property.city}, {property.postcode}</span>
            </div>
            {property.description && (
              <p className="text-sm text-slate-500">{property.description}</p>
            )}
          </div>

          {/* Documents */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Documents ({documents.length})
            </h2>
            {documents.filter(d => !d.is_archived).length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm text-slate-400">No documents have been uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.filter(d => !d.is_archived).map(doc => (
                  <DocumentRow key={doc.id} doc={doc} propertyId={propertyId} canEdit={false} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={property.name}
        description={`${property.address_line1}, ${property.city}`}
        action={
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => setVisitModalOpen(true)}>
              <CalendarClock size={15} />
              Schedule Visit
            </button>
            <button className="btn-primary" onClick={() => setInviteModalOpen(true)}>
              <Plus size={15} />
              Invite Tenant
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-8">
        {/* Property details */}
        <div className="card p-5 flex flex-wrap items-start gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Building2 size={20} className="text-slate-500" />
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PROPERTY_TYPE_COLOURS[property.property_type]}`}>
              {PROPERTY_TYPE_LABELS[property.property_type]}
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-sm text-slate-600">
            <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              {property.address_line1}{property.address_line2 ? `, ${property.address_line2}` : ''}, {property.city}, {property.postcode}
            </span>
          </div>
          {property.description && (
            <p className="text-sm text-slate-500 w-full">{property.description}</p>
          )}
        </div>

        {/* Tenants */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Tenants ({tenancies.length})
          </h2>
          {tenancies.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-slate-400">No tenants yet. Invite one using the button above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {tenancies.map(t => (
                <TenancyRow key={t.id} tenancy={t} propertyId={propertyId} />
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Documents ({documents.filter(d => !d.is_archived).length})
            </h2>
            <button className="btn text-xs py-1.5 px-3" onClick={() => setUploadDocModalOpen(true)}>
              <Upload size={13} />
              Upload
            </button>
          </div>
          {documents.filter(d => !d.is_archived).length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-slate-400">No documents uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.filter(d => !d.is_archived).map(doc => (
                <DocumentRow key={doc.id} doc={doc} propertyId={propertyId} canEdit={true} />
              ))}
            </div>
          )}
          {documents.some(d => d.is_archived) && (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Archived ({documents.filter(d => d.is_archived).length})
              </h3>
              <div className="space-y-2">
                {documents.filter(d => d.is_archived).map(doc => (
                  <DocumentRow key={doc.id} doc={doc} propertyId={propertyId} canEdit={true} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pending invites */}
        {invites.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Pending Invites ({invites.length})
            </h2>
            <div className="space-y-2">
              {invites.map(invite => (
                <div key={invite.id} className="card px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link size={14} className="text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-500 truncate">
                      Expires {new Date(invite.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.token}`)
                        toast.success('Link copied')
                      }}
                      className="btn p-1.5"
                      title="Copy link"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => revokeInviteMutation.mutate(invite.id)}
                      className="btn p-1.5 text-red-500 hover:bg-red-50 hover:border-red-200"
                      title="Revoke invite"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {inviteModalOpen && (
        <InviteModal propertyId={propertyId} onClose={() => setInviteModalOpen(false)} />
      )}
      {visitModalOpen && (
        <ScheduleVisitModal propertyId={propertyId} tenancies={tenancies} onClose={() => setVisitModalOpen(false)} />
      )}
      {uploadDocModalOpen && (
        <UploadDocumentModal propertyId={propertyId} onClose={() => setUploadDocModalOpen(false)} />
      )}
    </div>
  )
}
