import PageHeader from '../components/PageHeader'
import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome back"
      />

      <div className="p-8">
        <div className="card p-6">
          <p className="text-slate-600">
            Hello, <span className="font-medium text-slate-900">@{user?.username}</span>. What would you like to do today?
          </p>
        </div>
      </div>
    </div>
  )
}
