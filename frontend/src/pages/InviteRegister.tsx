import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, Eye, EyeOff, Zap } from 'lucide-react'
import { getInviteInfo, registerByInvite } from '../api/tenancies'
import { useAuth } from '../hooks/useAuth'

export default function InviteRegister() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => getInviteInfo(token!),
    retry: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setError('')
    setSubmitting(true)
    try {
      const res = await registerByInvite({ token, email, username, password })
      loginWithToken(res.access_token, res.user)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading invite…</p>
      </div>
    )
  }

  if (isError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm text-center">
          <div className="card p-8">
            <p className="text-sm font-medium text-slate-900 mb-1">Invite not valid</p>
            <p className="text-xs text-slate-500">This invite link has expired, already been used, or does not exist.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600">
              <Zap size={24} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">You've been invited to join a property</p>
        </div>

        {/* Property info */}
        <div className="card px-4 py-3 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <Building2 size={15} className="text-slate-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{invite.property_name}</p>
            <p className="text-xs text-slate-500">{invite.property_address}</p>
            <p className="text-xs text-slate-400 mt-0.5">Invited by @{invite.landlord_username}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email address</label>
            <input type="email" required className="input w-full" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
            <input type="text" required className="input w-full" value={username} onChange={e => setUsername(e.target.value)} placeholder="yourname" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="input w-full pr-10"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full justify-center" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account & sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Already have an account?{' '}
          <a href="/login" className="text-violet-600 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}
