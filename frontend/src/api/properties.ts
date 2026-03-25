import api from './client'

export type PropertyType = 'flat' | 'house' | 'hmo'

export interface Property {
  id: number
  landlord_id: number
  name: string
  property_type: PropertyType
  address_line1: string
  address_line2: string | null
  city: string
  postcode: string
  description: string | null
  tenant_count: number
  open_ticket_count: number
  created_at: string
}

export interface PropertyCreate {
  name: string
  property_type: PropertyType
  address_line1: string
  address_line2?: string
  city: string
  postcode: string
  description?: string
}

export const listProperties = () =>
  api.get<Property[]>('/properties').then(r => r.data)

export const getProperty = (id: number) =>
  api.get<Property>(`/properties/${id}`).then(r => r.data)

export const createProperty = (data: PropertyCreate) =>
  api.post<Property>('/properties', data).then(r => r.data)

export const updateProperty = (id: number, data: Partial<PropertyCreate>) =>
  api.patch<Property>(`/properties/${id}`, data).then(r => r.data)

export const deleteProperty = (id: number) =>
  api.delete(`/properties/${id}`)
