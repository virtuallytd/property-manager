import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Zap,
  Settings,
  Shield,
  LogOut,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../hooks/useAuth'

const bottomItems = [
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col bg-[#0f172a]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
          <Zap size={16} className="text-white" />
        </div>
        <span className="text-base font-semibold text-white">Property Manager</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 pt-2">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
            )
          }
        >
          <LayoutDashboard size={16} />
          Dashboard
        </NavLink>
      </nav>

      {/* Bottom nav */}
      <div className="space-y-0.5 border-t border-white/5 px-3 py-3">
        {bottomItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}

        {/* Admin link — only shown to admins */}
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
              )
            }
          >
            <Shield size={16} />
            Admin
          </NavLink>
        )}
      </div>

      {/* User info + logout */}
      {user && (
        <div className="border-t border-white/5 px-3 py-3">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <div className="h-7 w-7 flex-shrink-0 rounded-full overflow-hidden bg-violet-700 flex items-center justify-center text-white text-xs font-semibold">
              {user.avatar_url
                ? <img src={user.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                : user.username.charAt(0).toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">@{user.username}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-xs ${user.role === 'admin' ? 'text-violet-400' : 'text-slate-500'}`}>
                  {user.role === 'admin' ? 'Admin' : 'User'}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
