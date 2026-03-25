import api from './client'

export type TicketType = 'maintenance' | 'visit_request'
export type TicketCategory = 'plumbing' | 'electrical' | 'general' | 'structural' | 'pest_control' | 'appliances'
export type TicketStatus = 'open' | 'closed'
export type VisitResponse = 'pending' | 'accepted' | 'rejected' | 'rescheduled'

export interface TicketAuthor {
  id: number
  username: string
  avatar_url: string | null
}

export interface TicketComment {
  id: number
  ticket_id: number
  author: TicketAuthor
  body: string
  created_at: string
}

export interface Ticket {
  id: number
  property_id: number
  created_by: number
  creator: TicketAuthor
  title: string
  description: string | null
  ticket_type: TicketType
  category: TicketCategory | null
  status: TicketStatus
  proposed_date: string | null
  visit_response: VisitResponse | null
  visit_suggested_date: string | null
  created_at: string
  updated_at: string
  comments: TicketComment[]
}

export type TicketListItem = Omit<Ticket, 'description' | 'visit_suggested_date' | 'comments'> & { unread: boolean }

export interface TicketCreate {
  property_id: number
  title: string
  description?: string
  ticket_type: TicketType
  category?: TicketCategory
  proposed_date?: string
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

export const createTicket = (data: TicketCreate) =>
  api.post<Ticket>('/tickets', data).then(r => r.data)

export const updateTicketStatus = (id: number, status: TicketStatus) =>
  api.patch<Ticket>(`/tickets/${id}/status`, { status }).then(r => r.data)

export const respondToVisit = (id: number, visit_response: VisitResponse, visit_suggested_date?: string) =>
  api.patch<Ticket>(`/tickets/${id}/visit-response`, { visit_response, visit_suggested_date }).then(r => r.data)

export const addComment = (ticketId: number, body: string) =>
  api.post<TicketComment>(`/tickets/${ticketId}/comments`, { body }).then(r => r.data)

export const markTicketRead = (ticketId: number) =>
  api.post(`/tickets/${ticketId}/read`)

export const getUnreadCount = () =>
  api.get<{ count: number }>('/tickets/unread-count').then(r => r.data)
