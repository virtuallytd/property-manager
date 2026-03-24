import api from './client'

export interface AppSettings {
  timezone: string
}

export const getSettings = () =>
  api.get<AppSettings>('/settings').then(r => r.data)

export const updateSettings = (data: Partial<AppSettings>) =>
  api.patch<AppSettings>('/settings', data).then(r => r.data)
