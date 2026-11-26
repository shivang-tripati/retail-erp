'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { FileText, PackageCheck, Printer, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { PageHeader, DataTable, EmptyState, Selector, StatusBadge, Confirmation } from '../foundation'
import { Panel } from '../analytics-controls'
import { useDemo } from '../demo-provider'
import { createDemoManifest, deliveryStoreLabel, deliveryTimeSlots, dispatchDemoManifest, dispatchReadiness, localDate, markDemoDeliveryReady, scheduleDemoDelivery } from '@/lib/fulfilment'
import { DeliveryDetailDrawer } from './shared'
import type { Delivery } from '@/lib/phase6-types'

const actor = 'Prince Tiwari'
const referenceDate = '2026-11-21'
const datePlus = (value: string, days: number) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }

export function DeliveryScheduling() {
  const { data, transact } = useDemo()
  const [deliveryId, setDeliveryId] = useState(''), [date, setDate] = useState(referenceDate), [slot, setSlot] = useState(deliveryTimeSlots[0]), [team, setTeam] = useState(''), [vehicle, setVehicle] = useState(''), [priority, setPriority] = useState('Standard'), [instructions, setInstructions] = useState(''), [error, setError] = useState(''), [weekStart, setWeekStart] = useState(referenceDate)
  const draftOrderIds = new Set(data.deliveryManifests.filter(item => item.status === 'Draft').flatMap(item => item.deliveryIds))
  const eligible = data.deliveries.filter(item => !draftOrderIds.has(item.id) && ['Pending', 'Scheduled', 'Rescheduled', 'Failed', 'Ready for Dispatch'].includes(item.status) && item.items.some(line => line.deliveredQuantity < line.quantity))
  const selected = eligible.find(item => item.id === deliveryId)
  const week = Array.from({ length: 7 }, (_, index) => datePlus(weekStart, index))
  function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!selected || !date || !slot || !team || !vehicle) { setError('Select an active delivery order, date, time slot, team and vehicle.'); return }
    try {
      transact(current => ({
        ...current, ...scheduleDemoDelivery(current, deliveryId, {
          date, timeSlot: slot, teamId: team, vehicleId: vehicle,
          priority: priority as Delivery['priority'], instructions, actor, now: new Date().toISOString()
        })
      }))
      toast.success('Delivery schedule saved.')
      setDeliveryId(''); setInstructions('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Schedule could not be saved. No records were changed.') }
  }
  const scheduleRows = useMemo(() => data.deliveries.filter(item => week.includes(item.scheduledDate) && item.status !== 'Cancelled')
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.timeSlot.localeCompare(b.timeSlot)), [data.deliveries, weekStart])
  return <div className="phase p6-page">
    <PageHeader eyebrow="Fulfilment / Planning" title="Delivery scheduling" description="Assign a date, time window, delivery team and vehicle. Previous schedules remain in the activity history." />
    <div className="p6-ops-grid">
      <Panel title="Schedule an order" meta="Team and vehicle overlaps are checked for matching demo time slots">
        <form className="crm-form" onSubmit={schedule} noValidate>
          <label className="crm-field">Delivery order<span>*</span><select required value={deliveryId} onChange={event => { setDeliveryId(event.target.value); setError('') }}><option value="">Select an order</option>{eligible.map(order => <option key={order.id} value={order.id}>{order.orderNumber} · {data.customers.find(customer => customer.id === order.customerId)?.name} · {order.status}</option>)}</select></label>
          <div className="crm-form-grid">
            <label className="crm-field">Delivery date<span>*</span><input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label>
            <label className="crm-field">Time slot<span>*</span><select required value={slot} onChange={event => setSlot(event.target.value)}>{deliveryTimeSlots.map(item => <option key={item}>{item}</option>)}</select></label>
            <label className="crm-field">Delivery team<span>*</span><select required value={team} onChange={event => setTeam(event.target.value)}><option value="">Select team</option>{data.deliveryTeams.filter(item => item.status === 'Available').map(item => <option key={item.id} value={item.id}>{item.name} · {item.lead}</option>)}</select></label>
            <label className="crm-field">Vehicle<span>*</span><select required value={vehicle} onChange={event => setVehicle(event.target.value)}><option value="">Select vehicle</option>{data.deliveryVehicles.filter(item => item.status === 'Available').map(item => <option key={item.id} value={item.id}>{item.registration} · {item.type}</option>)}</select></label>
            <label className="crm-field">Priority<span>*</span><select value={priority} onChange={event => setPriority(event.target.value)}><option>Standard</option><option>High</option><option>Urgent</option></select></label>
            <label className="crm-field crm-field-wide">Delivery instructions<input value={instructions} onChange={event => setInstructions(event.target.value)} placeholder="Gate, access or handling notes" /></label>
          </div>
          {selected && <p className="p6-notice"><b>Destination:</b> {selected.deliveryAddress} · {deliveryStoreLabel(selected.storeId, data)}</p>}
          {error && <p role="alert" className="crm-error">{error}</p>}
          <Button type="submit" disabled={!eligible.length}>Save schedule</Button>
        </form>
      </Panel>
      <Panel title="Weekly schedule" meta="Scheduled orders grouped by delivery day">
        <div className="p6-week-controls"><Button variant="outline" size="sm" onClick={() => setWeekStart(value => datePlus(value, -7))}>Previous week</Button><span>{localDate(week[0])} – {localDate(week[6])}</span><Button variant="outline" size="sm" onClick={() => setWeekStart(value => datePlus(value, 7))}>Next week</Button></div>
        {scheduleRows.length ? <div className="p6-week-list">{week.map(day => <section key={day}><h3>{localDate(day)}</h3>{scheduleRows.filter(item => item.scheduledDate === day).map(order => <button key={order.id} className="p6-schedule-item" onClick={() => setDeliveryId(order.id)}><b>{order.timeSlot || 'Time pending'}</b><span>{order.orderNumber} · {data.customers.find(item => item.id === order.customerId)?.name}</span><small>{data.deliveryTeams.find(item => item.id === order.deliveryTeamId)?.name || 'Team pending'} · {order.status}</small></button>)}{!scheduleRows.some(item => item.scheduledDate === day) && <p className="p6-empty-day">No deliveries scheduled</p>}</section>)}</div> : <EmptyState text="No deliveries are scheduled in this week." />}
      </Panel>
    </div>
  </div>
}

export function DispatchPreparation() {
  const { data, transact } = useDemo()
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [detail, setDetail] = useState<Delivery | null>(null), [error, setError] = useState('')
  const draftOrderIds = new Set(data.deliveryManifests.filter(item => item.status === 'Draft').flatMap(item => item.deliveryIds))
  const ready = data.deliveries.filter(order => order.status === 'Ready for Dispatch' && !draftOrderIds.has(order.id))
  const scheduled = data.deliveries.filter(order => order.status === 'Scheduled' || order.status === 'Rescheduled')
  function markReady(order: Delivery) {
    try {
      transact(current => ({ ...current, ...markDemoDeliveryReady(current, order.id, actor, new Date().toISOString()) }))
      toast.success(`${order.orderNumber} is ready for dispatch.`)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Could not prepare this order. No records were changed.') }
  }
  function toggle(order: Delivery, checked: boolean) {
    setError('')
    if (checked && selectedIds.length) {
      const first = ready.find(item => item.id === selectedIds[0])
      if (first && (first.storeId !== order.storeId || first.deliveryTeamId !== order.deliveryTeamId || first.vehicleId !== order.vehicleId)) {
        setError('A manifest can contain orders for one store, delivery team and vehicle.'); return
      }
    }
    setSelectedIds(current => checked ? [...current, order.id] : current.filter(id => id !== order.id))
  }
  function createManifest() {
    if (!selectedIds.length) { setError('Select one or more ready orders for a manifest.'); return }
    try {
      transact(current => ({ ...current, ...createDemoManifest(current, selectedIds, actor, new Date().toISOString()) }))
      toast.success('Dispatch manifest created. Confirm dispatch from the manifest register.')
      setSelectedIds([]); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Manifest could not be created. No records were changed.') }
  }
  return <div className="phase p6-page">
    <PageHeader eyebrow="Fulfilment / Dispatch" title="Dispatch preparation" description="Validate the sale, serials, team, vehicle and schedule before dispatch. POS already reduced available stock; dispatch never deducts it a second time." />
    <Panel title="Scheduled orders" meta="Prepare eligible orders for a dispatch manifest">
      {scheduled.length ? <DataTable columns={['Delivery order', 'Invoice / customer', 'Store', 'Schedule', 'Team / vehicle', 'Dispatch readiness', 'Action']} rows={scheduled.map(order => {
        const issues = order.status === 'Ready for Dispatch' ? dispatchReadiness(order, data) : []
        const sale = data.sales.find(item => item.id === order.saleId), customer = data.customers.find(item => item.id === order.customerId)
        return [<button className="crm-customer-link" key={order.id} onClick={() => setDetail(order)}><b>{order.orderNumber}</b><small>{order.status}</small></button>,
        <span key={order.id + 'sale'}>{sale?.invoiceNumber}<small className="p4-sub">{customer?.name}</small></span>, deliveryStoreLabel(order.storeId, data),
        `${localDate(order.scheduledDate)} · ${order.timeSlot}`, `${data.deliveryTeams.find(item => item.id === order.deliveryTeamId)?.name || 'Unassigned'} · ${data.deliveryVehicles.find(item => item.id === order.vehicleId)?.registration || 'No vehicle'}`,
        issues.length ? <span className="p6-warning">{issues.join(' ')}</span> : <StatusBadge>{order.status === 'Ready for Dispatch' ? 'Ready' : 'Schedule confirmed'}</StatusBadge>,
        <Button key={order.id + 'action'} size="sm" onClick={() => markReady(order)} disabled={order.status === 'Ready for Dispatch'}>{order.status === 'Ready for Dispatch' ? 'Ready' : 'Mark ready'}</Button>]
      })} /> : <EmptyState text="No scheduled orders need dispatch preparation." />}
    </Panel>
    <Panel title="Ready for dispatch" meta="Select one delivery team and vehicle grouping for each manifest">
      {ready.length ? <DataTable columns={['Select', 'Order', 'Customer / address', 'Store', 'Products / serials', 'Schedule', 'Team / vehicle', 'Readiness']} rows={ready.map(order => {
        const issues = dispatchReadiness(order, data)
        const customer = data.customers.find(item => item.id === order.customerId), team = data.deliveryTeams.find(item => item.id === order.deliveryTeamId), vehicle = data.deliveryVehicles.find(item => item.id === order.vehicleId)
        return [<input key={order.id + 'check'} type="checkbox" aria-label={`Select ${order.orderNumber} for dispatch manifest`} checked={selectedIds.includes(order.id)} onChange={event => toggle(order, event.target.checked)} />,
        <button className="crm-customer-link" key={order.id + 'order'} onClick={() => setDetail(order)}><b>{order.orderNumber}</b></button>,
        <span key={order.id + 'customer'}>{customer?.name}<small className="p4-sub">{order.deliveryAddress}</small></span>, deliveryStoreLabel(order.storeId, data),
        order.items.map(item => `${item.name} × ${item.quantity}${item.serials.length ? ` (${item.serials.join(', ')})` : ''}`).join('; '),
        `${localDate(order.scheduledDate)} · ${order.timeSlot}`, `${team?.name || 'Unassigned'} · ${vehicle?.registration || 'No vehicle'}`,
        issues.length ? <span className="p6-warning">{issues.join(' ')}</span> : <StatusBadge>Validated</StatusBadge>]
      })} /> : <EmptyState text="No orders are ready for dispatch." />}
      {error && <p role="alert" className="crm-error">{error}</p>}
      <div className="p6-action-row"><span>{selectedIds.length} selected</span><Button onClick={createManifest} disabled={!selectedIds.length}><FileText size={15} />Create dispatch manifest</Button></div>
    </Panel>
    <DeliveryDetailDrawer order={detail} open={!!detail} onClose={() => setDetail(null)} />
  </div>
}

export function DispatchManifests() {
  const { data, transact } = useDemo()
  const [selectedId, setSelectedId] = useState(''), [confirm, setConfirm] = useState(false), [error, setError] = useState('')
  const selected = data.deliveryManifests.find(item => item.id === selectedId)
  const orders = selected ? selected.deliveryIds.flatMap(id => data.deliveries.filter(item => item.id === id)) : []
  function confirmDispatch() {
    if (!selected) return
    try {
      transact(current => ({ ...current, ...dispatchDemoManifest(current, selected.id, actor, new Date().toISOString()) }))
      toast.success(`${selected.manifestNumber} dispatched; inventory was not changed.`); setConfirm(false); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Manifest dispatch failed. No records were changed.'); setConfirm(false) }
  }
  return <div className="phase p6-page">
    <PageHeader eyebrow="Fulfilment / Manifests" title="Dispatch manifests" description="Review grouped delivery paperwork, print a route sheet, then explicitly confirm dispatch." />
    <div className="p6-ops-grid p6-manifest-layout">
      <Panel title="Manifest register" meta="Draft and dispatched route sheets">
        {data.deliveryManifests.length ? <div className="p6-manifest-list">{[...data.deliveryManifests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(manifest => <button key={manifest.id} className={`p6-manifest-card ${selectedId === manifest.id ? 'active' : ''}`} onClick={() => { setSelectedId(manifest.id); setError('') }}>
          <span><b>{manifest.manifestNumber}</b><StatusBadge>{manifest.status}</StatusBadge></span><small>{localDate(manifest.createdAt)} · {manifest.deliveryIds.length} orders</small><small>{deliveryStoreLabel(manifest.storeId, data)} · {data.deliveryTeams.find(item => item.id === manifest.deliveryTeamId)?.name} · {data.deliveryVehicles.find(item => item.id === manifest.vehicleId)?.registration}</small>
        </button>)}</div> : <EmptyState text="No dispatch manifests have been generated." />}
      </Panel>
      <Panel title={selected?.manifestNumber || 'Manifest details'} meta="Fictional dispatch worksheet; not a carrier or transport document">
        {selected ? <div className="p6-manifest-detail p6-print-document p6-active-print">
          <div className="p6-manifest-meta"><span><small>Store / warehouse</small><b>{deliveryStoreLabel(selected.storeId, data)}</b></span><span><small>Team</small><b>{data.deliveryTeams.find(item => item.id === selected.deliveryTeamId)?.name || '—'}</b></span><span><small>Vehicle</small><b>{data.deliveryVehicles.find(item => item.id === selected.vehicleId)?.registration || '—'}</b></span><span><small>Dispatch status</small><b>{selected.status}</b></span></div>
          {orders.length ? <DataTable columns={['Delivery order', 'Customer / address', 'Products and serials', 'Schedule']} rows={orders.map(order => [
            <span key={order.id}><b>{order.orderNumber}</b><small className="p4-sub">{data.sales.find(item => item.id === order.saleId)?.invoiceNumber}</small></span>,
            <span key={order.id + 'customer'}>{data.customers.find(item => item.id === order.customerId)?.name}<small className="p4-sub">{order.deliveryAddress}</small></span>,
            order.items.map(item => `${item.name} × ${item.quantity}${item.serials.length ? ` · ${item.serials.join(', ')}` : ''}`).join('; '),
            `${localDate(order.scheduledDate)} · ${order.timeSlot}`
          ])} /> : <EmptyState text="This manifest has no delivery orders." />}
          <div className="p6-action-row"><Button variant="outline" onClick={() => window.print()}><Printer size={15} />Print manifest</Button><Button onClick={() => setConfirm(true)} disabled={selected.status !== 'Draft'}><Truck size={15} />Confirm dispatch</Button></div>
          {selected.dispatchedAt && <p className="p6-caption">Dispatched {localDate(selected.dispatchedAt)} by {selected.dispatchedBy}. No additional stock deduction was made.</p>}
          {error && <p role="alert" className="crm-error">{error}</p>}
        </div> : <EmptyState text="Choose a manifest to review its route and delivery orders." />}
      </Panel>
    </div>
    <Confirmation open={confirm} title="Confirm dispatch?" text={`Record ${selected?.manifestNumber || 'this manifest'} as dispatched. Delivery statuses and sold serial references will update; inventory will not be deducted again.`} onClose={() => setConfirm(false)} onConfirm={confirmDispatch} />
  </div>
}
