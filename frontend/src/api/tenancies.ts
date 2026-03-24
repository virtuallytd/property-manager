import api from './client'

export interface TenantOut {
  id: number
  email: string
  username: string
  avatar_url: string | null
}

export interface Tenancy {
  id: number
  property_id: number
  tenant: TenantOut
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
}

export interface Invite {
  id: number
  token: string
  property_id: number
  expires_at: string
  used_at: string | null
  created_at: string
}

export interface InviteInfo {
  property_name: string
  property_address: string
  landlord_username: string
  token: string
}

export interface LandlordOut {
  id: number
  username: string
  email: string
  avatar_url: string | null
}

export interface MyProperty {
  tenancy_id: number
  property_id: number
  name: string
  property_type: string
  address_line1: string
  address_line2: string | null
  city: string
  postcode: string
  description: string | null
  landlord: LandlordOut
  start_date: string | null
  end_date: string | null
  notes: string | null
}

export const listTenancies = (propertyId: number) =>
  api.get<Tenancy[]>(`/properties/${propertyId}/tenancies`).then(r => r.data)

export const updateTenancy = (propertyId: number, tenancyId: number, data: { start_date?: string | null; end_date?: string | null; notes?: string | null }) =>
  api.patch<Tenancy>(`/properties/${propertyId}/tenancies/${tenancyId}`, data).then(r => r.data)

export const removeTenancy = (propertyId: number, tenancyId: number) =>
  api.delete(`/properties/${propertyId}/tenancies/${tenancyId}`)

export const listInvites = (propertyId: number) =>
  api.get<Invite[]>(`/properties/${propertyId}/invites`).then(r => r.data)

export const createInvite = (propertyId: number, expiresAt: string) =>
  api.post<Invite>(`/properties/${propertyId}/invites`, { expires_at: expiresAt }).then(r => r.data)

export const revokeInvite = (propertyId: number, inviteId: number) =>
  api.delete(`/properties/${propertyId}/invites/${inviteId}`)

export const myProperties = () =>
  api.get<MyProperty[]>('/properties/mine').then(r => r.data)

export const getInviteInfo = (token: string) =>
  api.get<InviteInfo>(`/auth/invite/${token}`).then(r => r.data)

export const registerByInvite = (data: { token: string; email: string; username: string; password: string }) =>
  api.post<{ access_token: string; token_type: string; user: any }>('/auth/register-invite', data).then(r => r.data)
