import api from './client'

export type DocumentType = 'gas_safety' | 'epc' | 'electrical' | 'fire_risk' | 'insurance' | 'other'

export interface PropertyDocument {
  id: number
  property_id: number
  document_type: DocumentType
  display_name: string
  url: string
  content_type: string
  expires_at: string | null
  is_archived: boolean
  created_at: string
  uploaded_by_username: string
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  gas_safety: 'Gas Safety Certificate',
  epc: 'EPC Certificate',
  electrical: 'Electrical Safety Report',
  fire_risk: 'Fire Risk Assessment',
  insurance: 'Building Insurance',
  other: 'Other',
}

export const DOCUMENT_TYPES: DocumentType[] = ['gas_safety', 'epc', 'electrical', 'fire_risk', 'insurance', 'other']

export const listDocuments = (propertyId: number) =>
  api.get<PropertyDocument[]>(`/properties/${propertyId}/documents`).then(r => r.data)

export const uploadDocument = (propertyId: number, documentType: DocumentType, displayName: string, file: File, expiresAt?: string) => {
  const form = new FormData()
  form.append('document_type', documentType)
  form.append('display_name', displayName)
  if (expiresAt) form.append('expires_at', expiresAt)
  form.append('file', file)
  return api.post<PropertyDocument>(`/properties/${propertyId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const updateDocument = (
  propertyId: number,
  docId: number,
  data: { display_name?: string; expires_at?: string; clear_expiry?: boolean; is_archived?: boolean },
) => api.patch<PropertyDocument>(`/properties/${propertyId}/documents/${docId}`, data).then(r => r.data)

export const deleteDocument = (propertyId: number, docId: number) =>
  api.delete(`/properties/${propertyId}/documents/${docId}`)
