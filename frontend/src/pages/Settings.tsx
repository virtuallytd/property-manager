import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Camera, Clock, Eye, EyeOff, Save, Search } from 'lucide-react'
import { getSettings, updateSettings } from '../api/settings'
import { updateMe, uploadAvatar } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import PageHeader from '../components/PageHeader'

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'timezone', label: 'Timezone' },
] as const

type TabId = typeof TABS[number]['id']

// ─── Account tab ────────────────────────────────────────────────────────────

function AccountTab() {
  const { user, refreshUser } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => { toast.success('Profile picture updated'); refreshUser() },
    onError: () => toast.error('Failed to upload picture'),
  })

  const emailMutation = useMutation({
    mutationFn: () => updateMe({ email }),
    onSuccess: () => { toast.success('Email updated'); refreshUser() },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to update email'),
  })

  const passwordMutation = useMutation({
    mutationFn: () => updateMe({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      toast.success('Password updated')
      setCurrentPassword('')
      setNewPassword('')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Failed to update password'),
  })

  return (
    <div className="space-y-6">
      {/* Profile info */}
      <div className="card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Profile</h3>
          <p className="text-xs text-slate-500">Your account details.</p>
        </div>
        <div className="flex items-center gap-4 py-2">
          <label className="relative group cursor-pointer shrink-0">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-violet-700 text-xl font-bold">
                  {user?.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={18} className="text-white" />
            </div>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) avatarMutation.mutate(file)
                e.target.value = ''
              }}
            />
          </label>
          <div>
            <p className="text-sm font-semibold text-slate-900">@{user?.username}</p>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{user?.role}</p>
            <p className="text-xs text-slate-400 mt-1">Click avatar to change</p>
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Email address</h3>
          <p className="text-xs text-slate-500">Used to sign in to your account.</p>
        </div>
        <input
          type="email"
          className="input w-full"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            className="btn-primary"
            onClick={() => emailMutation.mutate()}
            disabled={emailMutation.isPending || !email || email === user?.email}
          >
            <Save size={15} />
            {emailMutation.isPending ? 'Saving…' : 'Update Email'}
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Change password</h3>
          <p className="text-xs text-slate-500">Choose a strong password you don't use elsewhere.</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Current password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                className="input w-full pr-10"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowCurrent(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">New password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className="input w-full pr-10"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowNew(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <button
            className="btn-primary"
            onClick={() => passwordMutation.mutate()}
            disabled={passwordMutation.isPending || !currentPassword || !newPassword}
          >
            <Save size={15} />
            {passwordMutation.isPending ? 'Saving…' : 'Update Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Timezone tab ────────────────────────────────────────────────────────────

const ALL_TIMEZONES: string[] = Intl.supportedValuesOf('timeZone')

function LiveClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)

  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
      <Clock size={16} className="text-violet-500 shrink-0" />
      <span className="font-mono text-sm text-slate-700">{formatted}</span>
    </div>
  )
}

function TimezoneTab() {
  const queryClient = useQueryClient()
  const { data: current } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [selected, setSelected] = useState('UTC')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (current?.timezone) setSelected(current.timezone)
  }, [current?.timezone])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = search
    ? ALL_TIMEZONES.filter(tz => tz.toLowerCase().includes(search.toLowerCase()))
    : ALL_TIMEZONES

  const mutation = useMutation({
    mutationFn: () => updateSettings({ timezone: selected }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Timezone saved')
    },
    onError: () => toast.error('Failed to save timezone'),
  })

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Timezone</h3>
        <p className="text-xs text-slate-500">
          All scheduled times will be displayed and interpreted in this timezone.
        </p>
      </div>

      <LiveClock timezone={selected} />

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setSearch('') }}
          className="input flex items-center justify-between text-left w-full"
        >
          <span>{selected}</span>
          <span className="text-slate-400 text-xs">▼</span>
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search timezones…"
                  className="input pl-8 py-1.5 text-xs"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400">No results</div>
              ) : (
                filtered.map(tz => (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => { setSelected(tz); setOpen(false); setSearch('') }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                      tz === selected ? 'bg-violet-50 text-violet-700 font-medium' : 'text-slate-700'
                    }`}
                  >
                    {tz}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-2">
        <button
          className="btn-primary"
          onClick={() => mutation.mutate()}
          disabled={selected === current?.timezone || mutation.isPending}
        >
          <Save size={15} />
          {mutation.isPending ? 'Saving…' : 'Save Timezone'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('account')

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <div className="p-8">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'account' && <AccountTab />}
        {activeTab === 'timezone' && <TimezoneTab />}
      </div>
    </div>
  )
}
