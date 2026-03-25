import { useContext, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Building2, Send } from 'lucide-react'
import {
  type TicketStatus,
  type VisitResponse,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  VISIT_RESPONSE_LABELS,
  addComment,
  getTicket,
  markTicketRead,
  respondToVisit,
  updateTicketStatus,
} from '../api/tickets'
import { AuthContext } from '../contexts/AuthContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<TicketStatus, string> = {
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  awaiting_tenant: 'bg-amber-100 text-amber-700',
  resolved: 'bg-violet-100 text-violet-700',
  closed: 'bg-slate-100 text-slate-500',
}

const PRIORITY_COLOURS = {
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
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const LANDLORD_STATUSES: TicketStatus[] = ['open', 'in_progress', 'awaiting_tenant', 'resolved', 'closed']

// ─── Visit response panel ─────────────────────────────────────────────────────

function VisitResponsePanel({ ticketId, currentResponse }: { ticketId: number; currentResponse: VisitResponse }) {
  const queryClient = useQueryClient()
  const [suggestedDate, setSuggestedDate] = useState('')

  const mutation = useMutation({
    mutationFn: (response: VisitResponse) =>
      respondToVisit(ticketId, response, response === 'rescheduled' ? suggestedDate : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Response saved')
    },
    onError: () => toast.error('Failed to save response'),
  })

  if (currentResponse !== 'pending') return null

  return (
    <div className="card p-5 space-y-4 border-amber-200 bg-amber-50">
      <p className="text-sm font-medium text-amber-900">Your landlord has requested a visit. How would you like to respond?</p>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn bg-green-600 text-white hover:bg-green-700 border-green-600"
          onClick={() => mutation.mutate('accepted')}
          disabled={mutation.isPending}
        >
          Accept
        </button>
        <button
          className="btn bg-red-500 text-white hover:bg-red-600 border-red-500"
          onClick={() => mutation.mutate('rejected')}
          disabled={mutation.isPending}
        >
          Reject
        </button>
      </div>

      <div className="border-t border-amber-200 pt-4 space-y-2">
        <p className="text-xs font-medium text-amber-800">Or suggest an alternative date:</p>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            className="input flex-1 text-sm"
            value={suggestedDate}
            onChange={e => setSuggestedDate(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => mutation.mutate('rescheduled')}
            disabled={mutation.isPending || !suggestedDate}
          >
            Suggest
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const ticketId = Number(id)
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const queryClient = useQueryClient()
  const [commentBody, setCommentBody] = useState('')

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
  })

  useEffect(() => {
    if (ticket) {
      markTicketRead(ticketId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['tickets'] })
        queryClient.invalidateQueries({ queryKey: ['tickets-unread-count'] })
      })
    }
  }, [ticket?.id])

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) => updateTicketStatus(ticketId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  const commentMutation = useMutation({
    mutationFn: () => addComment(ticketId, commentBody),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      setCommentBody('')
    },
    onError: () => toast.error('Failed to add comment'),
  })

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
        <div className="card h-40 animate-pulse bg-slate-50" />
      </div>
    )
  }

  if (!ticket) return null

  const isLandlordOrAdmin = user?.role === 'landlord' || user?.role === 'admin'
  const isTenant = user?.role === 'tenant'
  const isVisit = ticket.ticket_type === 'visit_request'
  const isClosed = ticket.status === 'closed'

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/tickets')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={15} />
        Back to tickets
      </button>

      {/* Header card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-slate-900">{ticket.title}</h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Building2 size={12} />
              <span>{ticket.property_name}</span>
              <span>·</span>
              <span>Raised by @{ticket.creator.username}</span>
              <span>·</span>
              <span>{formatDateShort(ticket.created_at)}</span>
              {!isVisit && ticket.category && (
                <><span>·</span><span>{CATEGORY_LABELS[ticket.category]}</span></>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_COLOURS[ticket.priority]}`}>
              {PRIORITY_LABELS[ticket.priority]}
            </span>
            {isVisit && ticket.visit_response && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${VISIT_RESPONSE_COLOURS[ticket.visit_response]}`}>
                {VISIT_RESPONSE_LABELS[ticket.visit_response]}
              </span>
            )}
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOURS[ticket.status]}`}>
              {STATUS_LABELS[ticket.status]}
            </span>
          </div>
        </div>

        {/* Visit request details */}
        {isVisit && (
          <div className="rounded-lg bg-violet-50 border border-violet-100 px-4 py-3 text-sm space-y-1">
            <p className="font-medium text-violet-900">Proposed visit date</p>
            <p className="text-violet-700">{ticket.proposed_date ? formatDate(ticket.proposed_date) : '—'}</p>
            {ticket.visit_response === 'rescheduled' && ticket.visit_suggested_date && (
              <>
                <p className="font-medium text-violet-900 pt-1">Tenant's suggested date</p>
                <p className="text-violet-700">{formatDate(ticket.visit_suggested_date)}</p>
              </>
            )}
          </div>
        )}

        {ticket.description && (
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{ticket.description}</p>
        )}

        {/* Landlord status control */}
        {isLandlordOrAdmin && (
          <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
            <label className="text-xs font-medium text-slate-500 shrink-0">Status</label>
            <select
              className="input py-1 text-sm"
              value={ticket.status}
              onChange={e => statusMutation.mutate(e.target.value as TicketStatus)}
              disabled={statusMutation.isPending}
            >
              {LANDLORD_STATUSES.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Resolved confirmation panel (tenant only) */}
      {isTenant && ticket.status === 'resolved' && (
        <div className="card p-5 space-y-3 border-violet-200 bg-violet-50">
          <p className="text-sm font-medium text-violet-900">
            Your landlord has marked this issue as resolved. Confirm below to close it, or add a comment if further work is needed.
          </p>
          <button
            className="btn bg-violet-600 text-white hover:bg-violet-700 border-violet-600"
            onClick={() => statusMutation.mutate('closed')}
            disabled={statusMutation.isPending}
          >
            Confirm &amp; Close
          </button>
        </div>
      )}

      {/* Visit response panel (tenant only, pending requests) */}
      {isTenant && isVisit && ticket.visit_response === 'pending' && (
        <VisitResponsePanel ticketId={ticketId} currentResponse={ticket.visit_response} />
      )}

      {/* Comments */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {ticket.comments.length === 0 ? 'No comments yet' : `Comments (${ticket.comments.length})`}
        </h2>

        {ticket.comments.map(c => {
          const isOwn = c.author.id === user?.id
          return (
            <div key={c.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 uppercase">
                {c.author.avatar_url
                  ? <img src={c.author.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  : c.author.username.charAt(0)
                }
              </div>
              <div className={`max-w-[75%] space-y-1 ${isOwn ? 'items-end' : ''}`}>
                <div className={`rounded-xl px-4 py-2.5 text-sm ${isOwn ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {c.body}
                </div>
                <p className={`text-xs text-slate-400 ${isOwn ? 'text-right' : ''}`}>
                  @{c.author.username} · {formatDateShort(c.created_at)}
                </p>
              </div>
            </div>
          )
        })}

        {/* Comment box — disabled when closed */}
        {!isClosed && (
          <div className="flex gap-3 pt-2">
            <div className="h-7 w-7 shrink-0 rounded-full bg-violet-700 flex items-center justify-center text-xs font-semibold text-white uppercase">
              {user?.username.charAt(0)}
            </div>
            <div className="flex-1 flex gap-2">
              <textarea
                className="input flex-1 resize-none text-sm"
                rows={2}
                placeholder="Write a comment…"
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (commentBody.trim()) commentMutation.mutate()
                  }
                }}
              />
              <button
                className="btn btn-primary self-end px-3"
                onClick={() => commentMutation.mutate()}
                disabled={commentMutation.isPending || !commentBody.trim()}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
