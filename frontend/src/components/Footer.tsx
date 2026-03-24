import { useEffect, useState } from 'react'
import { useSettings } from '../hooks/useSettings'

export default function Footer() {
  const { timezone } = useSettings()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now)

  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now)

  return (
    <footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-2 text-xs text-slate-400">
      <span>{date}</span>
      <span className="font-mono tabular-nums text-slate-500">{time}</span>
      <span>{timezone}</span>
    </footer>
  )
}
