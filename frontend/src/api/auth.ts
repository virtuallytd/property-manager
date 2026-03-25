import api from './client'

export interface UserOut {
  id: number
  email: string
  username: string
  role: 'admin' | 'landlord' | 'tenant'
  is_approved: boolean
  is_active: boolean
  avatar_url: string | null
  created_at: string
  property_count?: number | null
  tenant_count?: number | null
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: UserOut
}

export const login = (email: string, password: string) =>
  api.post<TokenResponse>('/auth/login', { email, password }).then(r => r.data)

export const register = (email: string, username: string, password: string) =>
  api.post<UserOut>('/auth/register', { email, username, password }).then(r => r.data)

export const getMe = () =>
  api.get<UserOut>('/auth/me').then(r => r.data)

export const updateMe = (data: { email?: string; current_password?: string; new_password?: string }) =>
  api.patch<UserOut>('/auth/me', data).then(r => r.data)

export const uploadAvatar = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post<UserOut>('/auth/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

// Admin user management
export interface UserUpdate {
  is_approved?: boolean
  is_active?: boolean
  role?: 'admin' | 'landlord' | 'tenant'
}

export const adminListUsers = () =>
  api.get<UserOut[]>('/admin/users').then(r => r.data)

export const adminCreateUser = (data: { email: string; username: string; password: string; role: 'admin' | 'landlord' | 'tenant'; landlord_id?: number }) =>
  api.post<UserOut>('/admin/users', data).then(r => r.data)

export const adminListLandlords = () =>
  api.get<UserOut[]>('/admin/landlords').then(r => r.data)

export const adminUpdateUser = (userId: number, data: UserUpdate) =>
  api.patch<UserOut>(`/admin/users/${userId}`, data).then(r => r.data)

export const adminDeleteUser = (userId: number) =>
  api.delete(`/admin/users/${userId}`)

export interface AdminSettings {
  registration_enabled: string
  allowed_attachment_types: string  // comma-separated MIME types e.g. "image/*,application/pdf"
}

export const adminGetSettings = () =>
  api.get<AdminSettings>('/admin/settings').then(r => r.data)

export interface AdminStats {
  users: {
    total: number
    active: number
    pending_approval: number
    disabled: number
    admins: number
    landlords: number
    tenants: number
  }
  properties: {
    total: number
  }
}

export const adminGetStats = () =>
  api.get<AdminStats>('/admin/stats').then(r => r.data)

export const adminUpdateSettings = (data: { registration_enabled?: boolean; allowed_attachment_types?: string }) =>
  api.patch<AdminSettings>('/admin/settings', data).then(r => r.data)

export interface AppSettings {
  timezone: string
  allowed_attachment_types: string
}

export const getAppSettings = () =>
  api.get<AppSettings>('/settings').then(r => r.data)
