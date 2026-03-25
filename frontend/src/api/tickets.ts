import api from './client'

export type TicketType = 'maintenance' | 'visit_request'
export type TicketCategory = 'plumbing' | 'electrical' | 'general' | 'structural' | 'pest_control' | 'appliances'
export type TicketStatus = 'open' | 'in_progress' | 'awaiting_tenant' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type VisitResponse = 'pending' | 'accepted' | 'rejected' | 'rescheduled'

export interface TicketAuthor {
  id: number
  username: string
  avatar_url: string | null
}

export interface TicketAttachment {
  id: number
  original_filename: string
  url: string
  content_type: string
}

export interface TicketComment {
  id: number
  ticket_id: number
  author: TicketAuthor
  body: string
  created_at: string
  attachments: TicketAttachment[]
}

export interface Ticket {
  id: number
  property_id: number
  property_name: string
  created_by: number
  creator: TicketAuthor
  title: string
  description: string | null
  ticket_type: TicketType
  category: TicketCategory | null
  status: TicketStatus
  priority: TicketPriority
  proposed_date: string | null
  visit_response: VisitResponse | null
  visit_suggested_date: string | null
  created_at: string
  updated_at: string
  attachments: TicketAttachment[]
  comments: TicketComment[]
}

export type TicketListItem = Omit<Ticket, 'description' | 'visit_suggested_date' | 'comments'> & { unread: boolean }

export interface TicketCreate {
  property_id: number
  title: string
  description?: string
  ticket_type: TicketType
  category?: TicketCategory
  priority?: TicketPriority
  proposed_date?: string | Date
  tenant_id?: number
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  general: 'General',
  structural: 'Structural',
  pest_control: 'Pest Control',
  appliances: 'Appliances',
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  awaiting_tenant: 'Awaiting Tenant',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const VISIT_RESPONSE_LABELS: Record<VisitResponse, string> = {
  pending: 'Awaiting Response',
  accepted: 'Accepted',
  rejected: 'Rejected',
  rescheduled: 'Rescheduled',
}

export const listTickets = () =>
  api.get<TicketListItem[]>('/tickets').then(r => r.data)

export const getTicket = (id: number) =>
  api.get<Ticket>(`/tickets/${id}`).then(r => r.data)

export const createTicket = (data: TicketCreate, files?: File[]) => {
  const form = new FormData()
  form.append('property_id', String(data.property_id))
  form.append('title', data.title)
  if (data.description) form.append('description', data.description)
  if (data.ticket_type) form.append('ticket_type', data.ticket_type)
  if (data.category) form.append('category', data.category)
  if (data.priority) form.append('priority', data.priority)
  if (data.proposed_date) form.append('proposed_date', data.proposed_date instanceof Date ? data.proposed_date.toISOString() : String(data.proposed_date))
  if (data.tenant_id) form.append('tenant_id', String(data.tenant_id))
  if (files) files.forEach(f => form.append('files', f))
  return api.post<Ticket>('/tickets', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const updateTicketStatus = (id: number, status: TicketStatus) =>
  api.patch<Ticket>(`/tickets/${id}/status`, { status }).then(r => r.data)

export const respondToVisit = (id: number, visit_response: VisitResponse, visit_suggested_date?: string) =>
  api.patch<Ticket>(`/tickets/${id}/visit-response`, { visit_response, visit_suggested_date }).then(r => r.data)

export const addComment = (ticketId: number, body: string, files?: File[]) => {
  const form = new FormData()
  form.append('body', body)
  if (files) files.forEach(f => form.append('files', f))
  return api.post<TicketComment>(`/tickets/${ticketId}/comments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const markTicketRead = (ticketId: number) =>
  api.post(`/tickets/${ticketId}/read`)

export const getUnreadCount = () =>
  api.get<{ count: number }>('/tickets/unread-count').then(r => r.data)
