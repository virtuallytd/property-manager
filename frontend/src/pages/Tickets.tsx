import { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Ticket as TicketIcon, Wrench, CalendarClock } from 'lucide-react'
import {
  type TicketCategory,
  type TicketPriority,
  type TicketListItem,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  VISIT_RESPONSE_LABELS,
  createTicket,
  listTickets,
} from '../api/tickets'
import { listProperties } from '../api/properties'
import { myProperties } from '../api/tenancies'
import { AuthContext } from '../contexts/AuthContext'
import PageHeader from '../components/PageHeader'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOURS = {
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  awaiting_tenant: 'bg-amber-100 text-amber-700',
  resolved: 'bg-violet-100 text-violet-700',
  closed: 'bg-slate-100 text-slate-500',
}

const PRIORITY_COLOURS: Record<TicketPriority, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-blue-50 text-blue-600',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-600',
}

const VISIT_RESPONSE_COLOURS = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  rescheduled: 'bg-blue-100 text-blue-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── New ticket modal ─────────────────────────────────────────────────────────

const CATEGORIES: TicketCategory[] = ['plumbing', 'electrical', 'general', 'structural', 'pest_control', 'appliances']
const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']

function NewTicketModal({
  properties,
  onClose,
}: {
  properties: { id: number; name: string }[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [propertyId, setPropertyId] = useState<number | ''>(properties.length === 1 ? properties[0].id : '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TicketCategory>('general')
  const [priority, setPriority] = useState<TicketPriority>('medium')

  const mutation = useMutation({
    mutationFn: () =>
      createTicket({
        property_id: Number(propertyId),
        title,
        description: description || undefined,
        ticket_type: 'maintenance',
        category,
        priority,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Request submitted')
      onClose()
    },
    onError: () => toast.error('Failed to submit request'),
  })

  const isValid = !!propertyId && title.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Raise a Maintenance Request</h2>
        </div>

        <div className="space-y-4 px-6 py-5">
          {properties.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Property</label>
              <select
                className="input w-full"
                value={propertyId}
                onChange={e => setPropertyId(Number(e.target.value))}
              >
                <option value="">Select a property…</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
            <input
              className="input w-full"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Leaking kitchen tap"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <select className="input w-full" value={category} onChange={e => setCategory(e.target.value as TicketCategory)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
              <select className="input w-full" value={priority} onChange={e => setPriority(e.target.value as TicketPriority)}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any additional details…"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isValid}
          >
            {mutation.isPending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Ticket row ───────────────────────────────────────────────────────────────

function TicketRow({ ticket }: { ticket: TicketListItem }) {
  const navigate = useNavigate()
  const isVisit = ticket.ticket_type === 'visit_request'

  return (
    <div
      className={`card px-5 py-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all ${ticket.unread ? 'border-violet-200 bg-violet-50/40' : ''}`}
      onClick={() => navigate(`/tickets/${ticket.id}`)}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isVisit ? 'bg-violet-100' : 'bg-blue-100'}`}>
        {isVisit
          ? <CalendarClock size={16} className="text-violet-600" />
          : <Wrench size={16} className="text-blue-600" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm truncate ${ticket.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-900'}`}>
            {ticket.title}
          </p>
          {ticket.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" />}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {ticket.property_name}
          {' · '}
          {isVisit
            ? `Visit · ${ticket.proposed_date ? formatDate(ticket.proposed_date) : 'No date'}`
            : ticket.category ? CATEGORY_LABELS[ticket.category] : 'General'
          }
          {' · '}@{ticket.creator.username}
          {' · '}{formatDate(ticket.updated_at)}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOURS[ticket.priority]}`}>
          {PRIORITY_LABELS[ticket.priority]}
        </span>
        {isVisit && ticket.visit_response && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VISIT_RESPONSE_COLOURS[ticket.visit_response]}`}>
            {VISIT_RESPONSE_LABELS[ticket.visit_response]}
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOURS[ticket.status]}`}>
          {STATUS_LABELS[ticket.status]}
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Tickets() {
  const { user } = useContext(AuthContext)
  const role = user?.role ?? 'tenant'

  const [tab, setTab] = useState<'active' | 'closed'>('active')
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: listTickets,
  })

  const { data: ownedProperties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: listProperties,
    enabled: role === 'landlord' || role === 'admin',
  })

  const { data: tenantProperties = [] } = useQuery({
    queryKey: ['my-properties'],
    queryFn: myProperties,
    enabled: role === 'tenant',
  })

  const properties = role === 'tenant'
    ? tenantProperties.map(p => ({ id: p.property_id, name: p.name }))
    : ownedProperties.map(p => ({ id: p.id, name: p.name }))

  const filtered = tickets.filter(t => {
    const isActive = t.status !== 'closed'
    if (tab === 'active' && !isActive) return false
    if (tab === 'closed' && isActive) return false
    if (selectedProperty && t.property_id !== selectedProperty) return false
    return true
  })

  return (
    <div>
      <PageHeader
        title="Tickets"
        description={role === 'tenant' ? 'Your maintenance requests' : 'Maintenance requests and visit schedules'}
        action={
          role === 'tenant' && properties.length > 0 ? (
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={15} />
              New Request
            </button>
          ) : undefined
        }
      />

      <div className="p-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden text-sm">
            {(['active', 'closed'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 font-medium transition-colors ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t === 'active' ? 'Active' : 'Closed'}
              </button>
            ))}
          </div>

          {properties.length > 1 && (
            <select
              className="input py-1.5 text-sm"
              value={selectedProperty ?? ''}
              onChange={e => setSelectedProperty(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All properties</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-slate-50" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <TicketIcon size={32} className="mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No {tab} tickets</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => <TicketRow key={t.id} ticket={t} />)}
          </div>
        )}
      </div>

      {modalOpen && (
        <NewTicketModal
          properties={properties}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
