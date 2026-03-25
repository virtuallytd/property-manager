import api from './client'

export interface PropertySummary {
  id: number
  name: string
}

export interface TenantOut {
  id: number
  username: string
  email: string
  current_property: PropertySummary | null
}

export const listTenants = () =>
  api.get<TenantOut[]>('/tenants').then(r => r.data)

export const assignTenant = (tenantId: number, propertyId: number) =>
  api.post(`/tenants/${tenantId}/assign/${propertyId}`).then(r => r.data)

export const unassignTenant = (tenantId: number) =>
  api.delete(`/tenants/${tenantId}/assign`).then(r => r.data)
