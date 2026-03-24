import { useQuery } from '@tanstack/react-query'
import { getSettings } from '../api/settings'

export function useSettings() {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: Infinity,
  })
  return data ?? { timezone: 'UTC' }
}

/** Format a date string or Date using the app's saved timezone. */
export function useFormatDate() {
  const { timezone } = useSettings()

  return (date: string | Date, opts?: Intl.DateTimeFormatOptions) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...opts,
    }).format(d)
  }
}
