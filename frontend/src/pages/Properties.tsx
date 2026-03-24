import { useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2, MapPin, Pencil, Plus, Trash2, Users, User } from 'lucide-react'
import {
  type Property,
  type PropertyCreate,
  type PropertyType,
  createProperty,
  deleteProperty,
  listProperties,
  updateProperty,
} from '../api/properties'
import { myProperties, type MyProperty } from '../api/tenancies'
import { AuthContext } from '../contexts/AuthContext'
import PageHeader from '../components/PageHeader'

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  flat: 'Flat',
  house: 'House',
  hmo: 'HMO',
}

const PROPERTY_TYPE_COLOURS: Record<PropertyType, string> = {
  flat: 'bg-blue-100 text-blue-700',
  house: 'bg-green-100 text-green-700',
  hmo: 'bg-violet-100 text-violet-700',
}

// ─── Landlord: form modal ─────────────────────────────────────────────────────

const EMPTY_FORM: PropertyCreate = {
  name: '',
  property_type: 'flat',
  address_line1: '',
  address_line2: '',
  city: '',
  postcode: '',
  description: '',
}

function PropertyModal({
  initial,
  onClose,
}: {
  initial?: Property
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PropertyCreate>(
    initial
      ? {
          name: initial.name,
          property_type: initial.property_type,
          address_line1: initial.address_line1,
          address_line2: initial.address_line2 ?? '',
          city: initial.city,
          postcode: initial.postcode,
          description: initial.description ?? '',
        }
      : EMPTY_FORM,
  )

  const set = (field: keyof PropertyCreate, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const mutation = useMutation({
    mutationFn: () =>
      initial
        ? updateProperty(initial.id, form)
        : createProperty(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      toast.success(initial ? 'Property updated' : 'Property created')
      onClose()
    },
    onError: () => toast.error('Failed to save property'),
  })

  const isValid = form.name && form.address_line1 && form.city && form.postcode

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {initial ? 'Edit Property' : 'Add Property'}
          </h2>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Property name / reference</label>
            <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Flat 1 – 23 Church Street" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Property type</label>
            <select className="input w-full" value={form.property_type} onChange={e => set('property_type', e.target.value as PropertyType)}>
              <option value="flat">Flat</option>
              <option value="house">House</option>
              <option value="hmo">HMO</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address line 1</label>
            <input className="input w-full" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="123 Example Street" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address line 2 <span className="text-slate-400">(optional)</span></label>
            <input className="input w-full" value={form.address_line2} onChange={e => set('address_line2', e.target.value)} placeholder="Flat 1, Floor 2…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
              <input className="input w-full" value={form.city} onChange={e => set('city', e.target.value)} placeholder="London" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Postcode</label>
              <input className="input w-full" value={form.postcode} onChange={e => set('postcode', e.target.value)} placeholder="SW1A 1AA" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description / notes <span className="text-slate-400">(optional)</span></label>
            <textarea className="input w-full resize-none" rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Any additional notes about this property…" />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate()} disabled={mutation.isPending || !isValid}>
            {mutation.isPending ? 'Saving…' : initial ? 'Save Changes' : 'Add Property'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Landlord: property card ──────────────────────────────────────────────────

function PropertyCard({ property, onEdit, onDelete }: { property: Property; onEdit: () => void; onDelete: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="card p-5 flex flex-col gap-4 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all" onClick={() => navigate(`/properties/${property.id}`)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Building2 size={20} className="text-slate-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 leading-tight">{property.name}</h3>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PROPERTY_TYPE_COLOURS[property.property_type]}`}>
              {PROPERTY_TYPE_LABELS[property.property_type]}
            </span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="btn p-1.5" title="Edit">
            <Pencil size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="btn p-1.5 text-red-500 hover:bg-red-50 hover:border-red-200" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-start gap-1.5 text-xs text-slate-500">
        <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
        <span>
          {property.address_line1}{property.address_line2 ? `, ${property.address_line2}` : ''}, {property.city}, {property.postcode}
        </span>
      </div>

      {property.description && (
        <p className="text-xs text-slate-400 line-clamp-2">{property.description}</p>
      )}

      <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <Users size={13} className="text-slate-400" />
        <span>{property.tenant_count} {property.tenant_count === 1 ? 'tenant' : 'tenants'}</span>
      </div>
    </div>
  )
}

// ─── Tenant: my property card ─────────────────────────────────────────────────

function MyPropertyCard({ property }: { property: MyProperty }) {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <Building2 size={20} className="text-slate-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 leading-tight">{property.name}</h3>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${PROPERTY_TYPE_COLOURS[property.property_type as PropertyType] ?? 'bg-slate-100 text-slate-600'}`}>
            {PROPERTY_TYPE_LABELS[property.property_type as PropertyType] ?? property.property_type}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-1.5 text-xs text-slate-500">
        <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
        <span>
          {property.address_line1}{property.address_line2 ? `, ${property.address_line2}` : ''}, {property.city}, {property.postcode}
        </span>
      </div>

      {property.description && (
        <p className="text-xs text-slate-400 line-clamp-2">{property.description}</p>
      )}

      <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <User size={13} className="text-slate-400" />
        <span>Landlord: {property.landlord.username}</span>
      </div>

      {property.start_date && (
        <div className="text-xs text-slate-500">
          Tenant from: {property.start_date}
        </div>
      )}
    </div>
  )
}

// ─── Landlord properties view ─────────────────────────────────────────────────

function LandlordProperties() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Property | undefined>()

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: listProperties,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      toast.success('Property deleted')
    },
    onError: () => toast.error('Failed to delete property'),
  })

  const openCreate = () => { setEditing(undefined); setModalOpen(true) }
  const openEdit = (p: Property) => { setEditing(p); setModalOpen(true) }
  const closeModal = () => { setModalOpen(false); setEditing(undefined) }

  const handleDelete = (p: Property) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    deleteMutation.mutate(p.id)
  }

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Manage your rental properties"
        action={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={15} />
            Add Property
          </button>
        }
      />

      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card h-48 animate-pulse bg-slate-50" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <Building2 size={32} className="mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No properties yet</p>
            <button className="btn-primary mt-4" onClick={openCreate}>
              <Plus size={15} />
              Add your first property
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map(p => (
              <PropertyCard key={p.id} property={p} onEdit={() => openEdit(p)} onDelete={() => handleDelete(p)} />
            ))}
          </div>
        )}
      </div>

      {modalOpen && <PropertyModal initial={editing} onClose={closeModal} />}
    </div>
  )
}

// ─── Tenant properties view ───────────────────────────────────────────────────

function TenantProperties() {
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['my-properties'],
    queryFn: myProperties,
  })

  return (
    <div>
      <PageHeader
        title="My Properties"
        description="Properties you are a tenant of"
      />

      <div className="p-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="card h-48 animate-pulse bg-slate-50" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <Building2 size={32} className="mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">You are not assigned to any properties yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map(p => (
              <MyPropertyCard key={p.tenancy_id} property={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Properties() {
  const { user } = useContext(AuthContext)

  if (user?.role === 'tenant') return <TenantProperties />
  return <LandlordProperties />
}
