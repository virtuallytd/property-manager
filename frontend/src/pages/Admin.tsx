import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Plus, Trash2, CheckCircle, XCircle, UserCheck, UserX, Shield, Building2, Users } from 'lucide-react'
import {
  adminListUsers,
  adminCreateUser,
  adminListLandlords,
  adminUpdateUser,
  adminDeleteUser,
  adminGetSettings,
  adminUpdateSettings,
  adminGetStats,
  type UserOut,
} from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import PageHeader from '../components/PageHeader'

type Tab = 'stats' | 'users' | 'settings'

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'landlord' | 'tenant'>('landlord')
  const [landlordId, setLandlordId] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  const { data: landlords = [] } = useQuery({
    queryKey: ['admin', 'landlords'],
    queryFn: adminListLandlords,
    enabled: role === 'tenant',
  })

  const mutation = useMutation({
    mutationFn: () => adminCreateUser({
      email,
      username,
      password,
      role,
      ...(role === 'tenant' && landlordId ? { landlord_id: Number(landlordId) } : {}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User created')
      onClose()
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create user')
    },
  })

  const canSubmit = !mutation.isPending && !!email && !!username && !!password &&
    (role !== 'tenant' || !!landlordId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-sm mx-4 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Create User</h2>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            className="input w-full"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
          <input
            type="text"
            className="input w-full"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="username"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            className="input w-full"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
          <select
            className="input w-full"
            value={role}
            onChange={e => {
              setRole(e.target.value as typeof role)
              setLandlordId('')
            }}
          >
            <option value="landlord">Landlord</option>
            <option value="tenant">Tenant</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {role === 'tenant' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Landlord</label>
            <select
              className="input w-full"
              value={landlordId}
              onChange={e => setLandlordId(Number(e.target.value))}
            >
              <option value="">Select a landlord…</option>
              {landlords.map(l => (
                <option key={l.id} value={l.id}>@{l.username}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1 justify-center" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary flex-1 justify-center"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
          >
            {mutation.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UsersTab() {
  const { user: currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminListUsers,
  })

  const approveMutation = useMutation({
    mutationFn: (userId: number) => adminUpdateUser(userId, { is_approved: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User approved')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (userId: number) => adminUpdateUser(userId, { is_approved: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User approval revoked')
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ userId, is_active }: { userId: number; is_active: boolean }) =>
      adminUpdateUser(userId, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User updated')
    },
  })

  const promoteAdminMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'admin' | 'landlord' | 'tenant' }) =>
      adminUpdateUser(userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Role updated')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => adminDeleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('User deleted')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to delete user')
    },
  })

  const pendingUsers = users.filter(u => !u.is_approved)
  const activeUsers = users.filter(u => u.is_approved)

  if (isLoading) {
    return <div className="text-sm text-slate-500 py-8 text-center">Loading users…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{users.length} total user{users.length !== 1 ? 's' : ''}</p>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={15} />
          Create User
        </button>
      </div>

      {pendingUsers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              {pendingUsers.length}
            </span>
            Pending Approval
          </h3>
          <div className="space-y-2">
            {pendingUsers.map(user => (
              <UserRow
                key={user.id}
                user={user}
                currentUserId={currentUser?.id}
                onApprove={() => approveMutation.mutate(user.id)}
                onReject={() => rejectMutation.mutate(user.id)}
                onToggleActive={(active) => toggleActiveMutation.mutate({ userId: user.id, is_active: active })}
                onToggleRole={(role) => promoteAdminMutation.mutate({ userId: user.id, role })}
                onDelete={() => deleteMutation.mutate(user.id)}
                pending
              />
            ))}
          </div>
        </div>
      )}

      <div>
        {pendingUsers.length > 0 && (
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Active Users</h3>
        )}
        <div className="space-y-2">
          {activeUsers.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No approved users yet</p>
          ) : (
            activeUsers.map(user => (
              <UserRow
                key={user.id}
                user={user}
                currentUserId={currentUser?.id}
                onApprove={() => approveMutation.mutate(user.id)}
                onReject={() => rejectMutation.mutate(user.id)}
                onToggleActive={(active) => toggleActiveMutation.mutate({ userId: user.id, is_active: active })}
                onToggleRole={(role) => promoteAdminMutation.mutate({ userId: user.id, role })}
                onDelete={() => deleteMutation.mutate(user.id)}
              />
            ))
          )}
        </div>
      </div>

      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} />}
    </div>
  )
}

interface UserRowProps {
  user: UserOut
  currentUserId?: number
  onApprove: () => void
  onReject: () => void
  onToggleActive: (active: boolean) => void
  onToggleRole: (role: 'admin' | 'landlord' | 'tenant') => void
  onDelete: () => void
  pending?: boolean
}

function UserRow({ user, currentUserId, onApprove, onReject: _onReject, onToggleActive, onToggleRole, onDelete, pending }: UserRowProps) {
  const isSelf = user.id === currentUserId

  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
      pending ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">@{user.username}</span>
          {user.role === 'admin' && (
            <span className="badge bg-violet-100 text-violet-700">Admin</span>
          )}
          {user.role === 'landlord' && (
            <span className="badge bg-blue-100 text-blue-700">Landlord</span>
          )}
          {user.role === 'tenant' && (
            <span className="badge bg-green-100 text-green-700">Tenant</span>
          )}
          {!user.is_active && (
            <span className="badge bg-slate-100 text-slate-500">Disabled</span>
          )}
          {isSelf && (
            <span className="badge bg-blue-100 text-blue-700">You</span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">{user.email}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-slate-400">Joined {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          {user.role === 'landlord' && (
            <>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Building2 size={11} />
                {user.property_count ?? 0} {user.property_count === 1 ? 'property' : 'properties'}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Users size={11} />
                {user.tenant_count ?? 0} {user.tenant_count === 1 ? 'tenant' : 'tenants'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {pending ? (
          <>
            <button
              onClick={onApprove}
              title="Approve"
              className="btn-secondary text-green-700 border-green-200 hover:bg-green-50 px-2 py-1 text-xs"
            >
              <CheckCircle size={14} />
              Approve
            </button>
            <button
              onClick={onDelete}
              title="Delete"
              className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 px-2 py-1 text-xs"
              disabled={isSelf}
            >
              <XCircle size={14} />
              Reject
            </button>
          </>
        ) : (
          <>
            {!isSelf && (
              <>
                <button
                  onClick={() => onToggleActive(!user.is_active)}
                  title={user.is_active ? 'Disable' : 'Enable'}
                  className="btn-secondary px-2 py-1 text-xs"
                >
                  {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                  {user.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => onToggleRole(user.role === 'admin' ? 'landlord' : 'admin')}
                  title={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  className="btn-secondary px-2 py-1 text-xs"
                >
                  <Shield size={14} />
                  {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                </button>
                <button
                  onClick={onDelete}
                  title="Delete user"
                  className="btn-secondary text-red-600 border-red-200 hover:bg-red-50 px-2 py-1 text-xs"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <span className="text-base font-bold">{value}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function StatsTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminGetStats,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="card h-32 animate-pulse bg-slate-50" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Users</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Users" value={stats.users.total} color="bg-slate-100 text-slate-600" />
          <StatCard label="Landlords" value={stats.users.landlords} color="bg-blue-100 text-blue-700" />
          <StatCard label="Tenants" value={stats.users.tenants} color="bg-green-100 text-green-700" />
          <StatCard label="Pending Approval" value={stats.users.pending_approval} color="bg-amber-100 text-amber-700" />
          <StatCard label="Disabled" value={stats.users.disabled} color="bg-red-100 text-red-600" />
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Properties</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Properties" value={stats.properties.total} color="bg-violet-100 text-violet-700" />
        </div>
      </div>
    </div>
  )
}

function SettingsTab() {
  const queryClient = useQueryClient()
  const { data: adminSettings } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: adminGetSettings,
  })

  const registrationEnabled = adminSettings?.registration_enabled === 'true'

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => adminUpdateSettings({ registration_enabled: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      toast.success('Settings updated')
    },
    onError: () => toast.error('Failed to update settings'),
  })

  return (
    <div className="space-y-4 max-w-lg">
      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-900">User Registration</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Allow new users to self-register. When disabled, only admins can create accounts.
          </p>
        </div>
        <button
          onClick={() => mutation.mutate(!registrationEnabled)}
          disabled={mutation.isPending}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
            registrationEnabled ? 'bg-violet-600' : 'bg-slate-200'
          }`}
          role="switch"
          aria-checked={registrationEnabled}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              registrationEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

const TAB_LABELS: Record<Tab, string> = {
  stats: 'Stats',
  users: 'Users',
  settings: 'Settings',
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('stats')

  return (
    <div>
      <PageHeader title="Admin" description="Manage users and application settings" />

      <div className="p-8">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 mb-6">
          {(['stats', 'users', 'settings'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
