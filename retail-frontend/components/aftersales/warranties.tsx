'use client'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, Plus, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { useDemo } from '@/components/demo-provider'
import { PageHeader, DataTable, DetailDrawer, EmptyState, SearchBar, Selector, Confirmation } from '@/components/foundation'
import { Panel } from '@/components/analytics-controls'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { addMonthsToDate, canRegisterWarranty } from '@/lib/aftersales'
import { currency, dateInIndia } from '@/lib/phase3-data'
import type { WarrantyKind, WarrantyPlan, WarrantyRegistration, WarrantyStatus } from '@/lib/phase7-types'
import { AfterSalesMetrics, PrototypeNote } from './common'
import { ServiceTicketDialog } from './service-ticket-dialog'

type WarrantyView = {
  id: string; reference: string; kind: WarrantyKind; customerId: string; customerName: string; productId: string; productName: string; serial: string
  invoiceNumber: string; startDate: string; endDate: string; registrationDate: string; planName: string; status: WarrantyStatus
  storeId: string; pricePaise: number; exclusions: string; registration?: WarrantyRegistration
}

export function WarrantyDashboard() {
  const { data } = useDemo()
  const rows = warrantyRows(data)
  const retailer = rows.filter(item => item.kind === 'Retailer Extended')
  const active = rows.filter(item => item.status === 'Active')
  const expiring = rows.filter(item => item.status === 'Expiring Soon')
  const expired = rows.filter(item => item.status === 'Expired')
  const recentlyRegistered = retailer.slice().sort((a, b) => b.registrationDate.localeCompare(a.registrationDate)).slice(0, 6)
  const month = new Date().toISOString().slice(0, 7)
  const thisMonth = retailer.filter(item => item.registrationDate.slice(0, 7) === month).length
  const recentExpiry = expiring.slice().sort((a, b) => a.endDate.localeCompare(b.endDate)).slice(0, 5)
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Warranty" title="Warranty coverage" description="Separate retailer extended registrations from illustrative manufacturer-term dates in the shared serial register." />
    <AfterSalesMetrics items={[
      { label: 'Active coverage records', value: String(active.length), note: 'Current on the demo reference date', accent: 'p7-metric-teal' },
      { label: 'Retailer registrations', value: String(retailer.length), note: `${thisMonth} registered this month` },
      { label: 'Expiring within 60 days', value: String(expiring.length), note: 'Review coverage end dates', accent: expiring.length ? 'p7-metric-amber' : '' },
      { label: 'Expired records', value: String(expired.length), note: 'Retained for history' },
      { label: 'Active plans', value: String(data.warrantyPlans.filter(item => item.status === 'Active').length), note: 'Retailer-managed demo plans' },
      { label: 'Unverified serial terms', value: String(data.serials.filter(item => item.status === 'Sold' && item.warrantyUntil).length), note: 'Displayed separately; not verified' }
    ]} />
    <div className="p7-overview-grid">
      <Panel title="Recent retailer registrations" meta="New extended coverage records" action={<Link className="p7-inline-link" href="/after-sales/warranty-registration">Register coverage <ArrowRight size={14} /></Link>}>
        {recentlyRegistered.length ? <DataTable columns={['Reference', 'Customer / product', 'Serial', 'Plan', 'Coverage end']} rows={recentlyRegistered.map(item => [
          item.reference, <div className="cellstack" key={item.id + 'customer'}><b>{item.customerName}</b><small>{item.productName}</small></div>,
          item.serial, item.planName, dateInIndia(item.endDate)
        ])} /> : <EmptyState text="No retailer plans have been registered yet." />}
      </Panel>
      <Panel title="Upcoming coverage end dates" meta="Records marked as expiring within 60 days">
        {recentExpiry.length ? <DataTable columns={['Customer', 'Product / serial', 'Coverage type', 'Ends']} rows={recentExpiry.map(item => [
          item.customerName, <div className="cellstack" key={item.id + 'product'}><b>{item.productName}</b><small>{item.serial}</small></div>, item.kind, dateInIndia(item.endDate)
        ])} /> : <EmptyState text="No coverage records are nearing their demo end date." />}
      </Panel>
    </div>
    <Panel title="Coverage by type" meta="Current dates from retailer registrations and serial records">
      <div className="p7-dashboard-links"><Link href="/after-sales/warranty-directory"><span><b>Warranty directory</b><small>{rows.length} coverage record(s) · active, expiring and expired</small></span><ArrowRight size={15} /></Link><Link href="/after-sales/warranty-plans"><span><b>Extended warranty plans</b><small>{data.warrantyPlans.filter(item => item.status === 'Active').length} active retailer plan(s)</small></span><ArrowRight size={15} /></Link><Link href="/after-sales/warranty-certificates"><span><b>Printable coverage summaries</b><small>Demo record only; not OEM certificates or guarantees</small></span><ArrowRight size={15} /></Link></div>
      <div className="p7-coverage-counts"><article><span>Retailer extended</span><strong>{retailer.length}</strong></article><article><span>Manufacturer term records</span><strong>{rows.filter(item => item.kind === 'Manufacturer').length}</strong></article><article><span>Pending start date</span><strong>{rows.filter(item => item.status === 'Pending Registration').length}</strong></article></div>
    </Panel>
    <PrototypeNote>Coverage dates come from fictional retailer registrations or a serial registry field and are not independently validated. This is not a manufacturer warranty decision, insurance policy or approved claim.</PrototypeNote>
  </div>
}

function getWarrantyStatus(startDate: string, endDate: string, stored: WarrantyStatus, referenceDate = new Date()) {
  if (stored === 'Cancelled') return 'Cancelled'
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T23:59:59`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Pending Registration'
  if (end < referenceDate) return 'Expired'
  if (start > referenceDate) return 'Pending Registration'
  if (end.getTime() - referenceDate.getTime() < 60 * 24 * 60 * 60 * 1000) return 'Expiring Soon'
  return 'Active'
}

function warrantyRows(data: ReturnType<typeof useDemo>['data']): WarrantyView[] {
  const extended: WarrantyView[] = data.warranties.flatMap(registration => {
    const sale = data.sales.find(item => item.id === registration.saleId)
    const customer = data.customers.find(item => item.id === registration.customerId)
    const product = data.products.find(item => item.id === registration.productId)
    if (!sale || !customer || !product) return []
    return [{
      id: registration.id, reference: registration.reference, kind: registration.kind, customerId: customer.id, customerName: customer.name,
      productId: product.id, productName: product.name, serial: registration.serial, invoiceNumber: registration.invoiceNumber,
      startDate: registration.startDate, endDate: registration.endDate, registrationDate: registration.registrationDate, planName: registration.planName,
      status: getWarrantyStatus(registration.startDate, registration.endDate, registration.status), storeId: sale.storeId, pricePaise: registration.pricePaise,
      exclusions: registration.exclusions, registration
    }]
  })
  const manufacturer: WarrantyView[] = data.serials.flatMap(serial => {
    if (serial.status !== 'Sold' || !serial.invoiceId || !serial.warrantyUntil) return []
    const sale = data.sales.find(item => item.invoiceNumber === serial.invoiceId && item.status === 'Completed')
    const customer = sale && data.customers.find(item => item.id === sale.customerId)
    const line = sale?.lines.find(item => item.productId === serial.productId && item.serials.includes(serial.serial))
    const product = data.products.find(item => item.id === serial.productId)
    if (!sale || !customer || !line || !product) return []
    const startDate = sale.date.slice(0, 10)
    return [{
      id: `OEM-${serial.serial}`, reference: `SERIAL-${serial.serial}`, kind: 'Manufacturer' as const, customerId: customer.id, customerName: customer.name,
      productId: product.id, productName: product.name, serial: serial.serial, invoiceNumber: sale.invoiceNumber, startDate, endDate: serial.warrantyUntil,
      registrationDate: startDate, planName: 'Manufacturer term in serial demo record', status: getWarrantyStatus(startDate, serial.warrantyUntil, 'Active'),
      storeId: sale.storeId, pricePaise: 0, exclusions: 'Manufacturer terms are not verified in this demo.'
    }]
  })
  return [...extended, ...manufacturer].sort((a, b) => b.registrationDate.localeCompare(a.registrationDate))
}

function planPrice(paise: number) { return currency(paise) }

export function WarrantyPlans() {
  const { data, update } = useDemo()
  const [query, setQuery] = useState(''), [status, setStatus] = useState('All statuses'), [draft, setDraft] = useState<WarrantyPlan | null>(null), [priceInput, setPriceInput] = useState('0.00'), [confirm, setConfirm] = useState<WarrantyPlan | null>(null), [error, setError] = useState('')
  const productCategories = [...new Set(data.products.map(item => item.category))]
  const brands = data.brands
  const filtered = data.warrantyPlans.filter(plan => (status === 'All statuses' || plan.status === status) && `${plan.name} ${plan.code} ${plan.description}`.toLowerCase().includes(query.trim().toLowerCase()))
  function start(plan?: WarrantyPlan) {
    setError('')
    setPriceInput(((plan?.pricePaise || 0) / 100).toFixed(2))
    setDraft(plan ? { ...plan, brandIds: [...plan.brandIds], categories: [...plan.categories] } : {
      id: '', name: '', code: '', brandIds: brands.map(item => item.id), categories: [], durationMonths: 12, description: '', exclusions: '',
      pricePaise: 0, status: 'Active', createdAt: '', updatedAt: ''
    })
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft) return
    const enteredPrice = Number(priceInput)
    if (!priceInput.trim() || !Number.isFinite(enteredPrice) || enteredPrice < 0 || !Number.isInteger(enteredPrice * 100)) { setError('Enter a non-negative plan price with no more than two decimal places.'); return }
    const clean = { ...draft, pricePaise: Math.round(enteredPrice * 100), name: draft.name.trim(), code: draft.code.trim().toUpperCase(), description: draft.description.trim(), exclusions: draft.exclusions.trim() }
    if (!clean.name || !clean.code || !clean.description || !clean.exclusions || !Number.isInteger(clean.durationMonths) || clean.durationMonths < 1 || clean.durationMonths > 120 ||
      !Number.isSafeInteger(clean.pricePaise) || clean.pricePaise < 0 || !clean.categories.length || !clean.brandIds.length) {
      setError('Complete all required fields. Duration must be 1–120 months, price must be non-negative, and at least one brand and category are required.')
      return
    }
    if (data.warrantyPlans.some(item => item.id !== clean.id && (item.code.toLowerCase() === clean.code.toLowerCase() || item.name.toLowerCase() === clean.name.toLowerCase()))) {
      setError('A plan with that name or code already exists.'); return
    }
    const now = new Date().toISOString(), record: WarrantyPlan = { ...clean, updatedAt: now, createdAt: clean.createdAt || now }
    update('warrantyPlans', clean.id ? data.warrantyPlans.map(item => item.id === clean.id ? record : item) : [...data.warrantyPlans, { ...record, id: crypto.randomUUID() }])
    toast.success(clean.id ? 'Warranty plan updated' : 'Warranty plan added')
    setDraft(null)
  }
  function toggle(plan: WarrantyPlan) {
    const next: WarrantyPlan['status'] = plan.status === 'Active' ? 'Inactive' : 'Active'
    update('warrantyPlans', data.warrantyPlans.map(item => item.id === plan.id ? { ...item, status: next, updatedAt: new Date().toISOString() } : item))
    setConfirm(null); toast.success(`${plan.name} is now ${next.toLowerCase()}`)
  }
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Coverage" title="Extended warranty plans" description="Manage fictional ACS Electronics plans separately from manufacturer coverage and terms." />
    <Panel title="Retailer plans" meta={`${filtered.length} of ${data.warrantyPlans.length} plans`} action={<Button onClick={() => start()}><Plus size={15} />Add plan</Button>}>
      <div className="crm-toolbar"><SearchBar label="Search plan name, code or description" value={query} onChange={setQuery} /><Selector label="Filter plan status" value={status} options={['All statuses', 'Active', 'Inactive']} onChange={setStatus} /></div>
      {filtered.length ? <DataTable columns={['Plan', 'Eligible products', 'Duration', 'Demo price', 'Status', 'Actions']} rows={filtered.map(plan => [
        <div className="cellstack" key={plan.id}><b>{plan.name}</b><small>{plan.code} · {plan.description}</small></div>,
        <div className="cellstack" key={plan.id + 'eligible'}><b>{plan.categories.join(', ')}</b><small>{plan.brandIds.length} eligible brand(s)</small></div>,
        `${plan.durationMonths} months`, planPrice(plan.pricePaise),
        <span className={`p7-status ${plan.status === 'Active' ? 'p7-completed' : 'p7-cancelled'}`} key={plan.id + 'status'}>{plan.status}</span>,
        <div className="p7-actions" key={plan.id + 'actions'}><Button size="sm" variant="outline" onClick={() => start(plan)}>Edit</Button><Button size="sm" variant="outline" onClick={() => plan.status === 'Active' ? setConfirm(plan) : toggle(plan)}>{plan.status === 'Active' ? 'Deactivate' : 'Activate'}</Button></div>
      ])} /> : <EmptyState text="No plans match the current search or status filter." />}
    </Panel>
    <PrototypeNote>These are fictional retailer-managed demo terms. They do not represent OEM coverage, insurance, an approved warranty claim or a production contract.</PrototypeNote>
    <Dialog open={!!draft} onOpenChange={open => !open && setDraft(null)}><DialogContent className="p7-dialog"><DialogTitle>{draft?.id ? 'Edit' : 'Add'} extended warranty plan</DialogTitle><DialogDescription>Changes are saved to the local demo state. Existing registrations retain their saved terms.</DialogDescription>{draft && <form className="crm-form" onSubmit={save} noValidate>
      <div className="crm-form-grid">
        <label className="crm-field">Plan name<span>*</span><input required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="crm-field">Plan code<span>*</span><input required value={draft.code} onChange={event => setDraft({ ...draft, code: event.target.value })} /></label>
        <label className="crm-field">Duration in months<span>*</span><input required type="number" min="1" max="120" step="1" value={draft.durationMonths} onChange={event => setDraft({ ...draft, durationMonths: Number(event.target.value) })} /></label>
        <label className="crm-field">Demo plan price (INR)<span>*</span><input required type="number" min="0" step="0.01" value={priceInput} onChange={event => setPriceInput(event.target.value)} /></label>
        <label className="crm-field crm-field-wide">Coverage description<span>*</span><textarea required rows={2} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
        <label className="crm-field crm-field-wide">Exclusions<span>*</span><textarea required rows={2} value={draft.exclusions} onChange={event => setDraft({ ...draft, exclusions: event.target.value })} /></label>
        <fieldset className="p7-serial-field"><legend>Product categories<span>*</span></legend>{productCategories.map(item => <label key={item}><input type="checkbox" checked={draft.categories.includes(item)} onChange={event => setDraft({ ...draft, categories: event.target.checked ? [...draft.categories, item] : draft.categories.filter(value => value !== item) })} />{item}</label>)}</fieldset>
        <fieldset className="p7-serial-field"><legend>Brands<span>*</span></legend><div className="p7-scroll-checks">{brands.map(item => <label key={item.id}><input type="checkbox" checked={draft.brandIds.includes(item.id)} onChange={event => setDraft({ ...draft, brandIds: event.target.checked ? [...draft.brandIds, item.id] : draft.brandIds.filter(value => value !== item.id) })} />{item.name}</label>)}</div></fieldset>
      </div>{error && <p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button type="submit">Save plan</Button></DialogFooter>
    </form>}</DialogContent></Dialog>
    <Confirmation open={!!confirm} onClose={() => setConfirm(null)} title={`Deactivate ${confirm?.name}?`} text="Existing registrations retain their terms. This plan cannot be selected for new warranty registrations." onConfirm={() => confirm && toggle(confirm)} />
  </div>
}

export function WarrantyRegistrationForm() {
  const { data, transact } = useDemo(), lock = useRef(false)
  const [serial, setSerial] = useState(''), [planId, setPlanId] = useState(''), [startDate, setStartDate] = useState(''), [acknowledged, setAcknowledged] = useState(false), [error, setError] = useState('')
  const eligibleSerials = useMemo(() => data.serials.filter(record => {
    if (record.status !== 'Sold' || !record.invoiceId) return false
    const sale = data.sales.find(item => item.invoiceNumber === record.invoiceId && item.status === 'Completed')
    return !!sale?.lines.some(line => line.productId === record.productId && line.serials.includes(record.serial))
  }), [data.serials, data.sales])
  const selectedSerial = eligibleSerials.find(item => item.serial === serial)
  const selectedSale = selectedSerial && data.sales.find(item => item.invoiceNumber === selectedSerial.invoiceId)
  const selectedProduct = selectedSerial && data.products.find(item => item.id === selectedSerial.productId)
  const customer = selectedSale && data.customers.find(item => item.id === selectedSale.customerId)
  const selectedPlan = data.warrantyPlans.find(item => item.id === planId)
  const suitablePlans = data.warrantyPlans.filter(plan => plan.status === 'Active' && selectedProduct && plan.categories.includes(selectedProduct.category) && plan.brandIds.includes(selectedProduct.brandId))
  const installation = selectedSerial && data.installations.find(item => item.serials?.includes(selectedSerial.serial) && item.status === 'Completed')
  const delivery = selectedSale && data.deliveries.find(item => item.saleId === selectedSale.id && item.items.some(line => line.deliveredSerials.includes(serial)))
  const defaultStart = installation?.completedAt?.slice(0, 10) || delivery?.updatedAt.slice(0, 10) || selectedSale?.date.slice(0, 10) || ''
  function changeSerial(value: string) { setSerial(value); setPlanId(''); setError(''); const record = eligibleSerials.find(item => item.serial === value); const sale = record && data.sales.find(item => item.invoiceNumber === record.invoiceId); const delivered = sale && data.deliveries.find(order => order.saleId === sale.id && order.items.some(line => line.deliveredSerials.includes(value))); setStartDate(delivered?.updatedAt.slice(0, 10) || sale?.date.slice(0, 10) || '') }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!serial || !planId || !startDate || !acknowledged) { setError('Select a sold serial, active plan, start date, and acknowledge the demo terms.'); return }
    if (lock.current) return
    lock.current = true
    try {
      const now = new Date().toISOString(), registeredBy = 'Prince Tiwari'
      transact(current => {
        const valid = canRegisterWarranty(current, serial, planId)
        const endDate = addMonthsToDate(startDate, valid.plan.durationMonths)
        const activeInstall = current.installations.find(item => item.serials?.includes(serial) && item.status === 'Completed')
        const linkedDelivery = current.deliveries.find(item => item.saleId === valid.sale.id && item.items.some(line => line.deliveredSerials.includes(serial)))
        const registration: WarrantyRegistration = {
          id: crypto.randomUUID(), reference: `EW-${new Date().getFullYear()}-${String(7001 + current.warranties.length).padStart(4, '0')}`,
          kind: 'Retailer Extended', customerId: valid.sale.customerId, saleId: valid.sale.id, invoiceNumber: valid.sale.invoiceNumber,
          productId: valid.product.id, serial, deliveryId: linkedDelivery?.id || '', installationId: activeInstall?.id || '', planId: valid.plan.id,
          planName: valid.plan.name, durationMonths: valid.plan.durationMonths, pricePaise: valid.plan.pricePaise, startDate, endDate,
          registrationDate: now.slice(0, 10), registeredBy, coverage: valid.plan.description, exclusions: valid.plan.exclusions, status: 'Active', cancellationReason: ''
        }
        return { ...current, warranties: [...current.warranties, registration] }
      })
      toast.success('Retailer extended warranty registered')
      setSerial(''); setPlanId(''); setStartDate(''); setAcknowledged(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Warranty registration failed. No record was saved.') }
    finally { lock.current = false }
  }
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Registration" title="Register extended warranty" description="Register retailer-managed demo cover against a completed sale and a serial recorded as sold." />
    <div className="p7-registration-grid">
      <Panel title="Warranty registration" meta="Serial, customer and invoice are validated against shared sales state">
        <form className="crm-form" onSubmit={submit} noValidate><div className="crm-form-grid">
          <label className="crm-field crm-field-wide">Sold product serial<span>*</span><select required value={serial} onChange={event => changeSerial(event.target.value)}><option value="">Select a sold serial number</option>{eligibleSerials.map(item => { const product = data.products.find(record => record.id === item.productId), sale = data.sales.find(record => record.invoiceNumber === item.invoiceId), customer = sale && data.customers.find(record => record.id === sale.customerId); return <option key={item.serial} value={item.serial}>{item.serial} · {product?.name || item.productId} · {customer?.name || sale?.invoiceNumber}</option> })}</select></label>
          {selectedSale && selectedProduct && <div className="p7-registration-summary"><b>{selectedProduct.name}</b><span>{customer?.name} · {selectedSale.invoiceNumber}</span><small>{selectedSale.status} · {data.stores.find(item => item.id === selectedSale.storeId)?.name || selectedSale.storeId} · {installation ? 'Installation completed' : delivery ? 'Delivery confirmed' : 'Delivery date unavailable'}</small></div>}
          <label className="crm-field">Extended plan<span>*</span><select required value={planId} onChange={event => setPlanId(event.target.value)}><option value="">Select an eligible plan</option>{suitablePlans.map(item => <option key={item.id} value={item.id}>{item.name} · {item.durationMonths} months · {currency(item.pricePaise)}</option>)}</select></label>
          <label className="crm-field">Coverage start date<span>*</span><input required type="date" value={startDate || defaultStart} onChange={event => setStartDate(event.target.value)} /></label>
          <label className="crm-field crm-field-wide">Plan terms{selectedPlan && <span className="p7-terms"><b>{selectedPlan.description}</b><span>Exclusions: {selectedPlan.exclusions}</span></span>}</label>
          <label className="p7-confirm crm-field-wide"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I acknowledge this is fictional retailer-managed demo coverage, not an OEM certificate or verified warranty.</label>
        </div>{!suitablePlans.length && serial && <p className="p7-muted">No active plan covers this brand and category. Select a different sold serial or update the plan directory.</p>}{error && <p role="alert" className="crm-error">{error}</p>}<Button type="submit" disabled={!suitablePlans.length}>Register extended warranty</Button></form>
      </Panel>
      <Panel title="Registration rules" meta="Prototype safeguards">
        <ul className="p7-rule-list"><li>Only sold serials linked to completed invoices can be registered.</li><li>The customer and product must match the source invoice.</li><li>Plans must be active and include the brand and category.</li><li>An active duplicate for the same serial and plan is rejected.</li><li>Manufacturer term details are displayed separately from retailer plans.</li></ul>
      </Panel>
    </div>
    <WarrantyRegistrationList />
    <PrototypeNote>Registration records are local demo data. The acknowledgement does not constitute a real contract, insurance policy or manufacturer registration.</PrototypeNote>
  </div>
}

function WarrantyRegistrationList() {
  const { data } = useDemo()
  const rows = warrantyRows(data).filter(item => item.kind === 'Retailer Extended')
  return <Panel title="Recent registrations" meta={`${rows.length} retailer registration(s)`}>
    {rows.length ? <DataTable columns={['Reference', 'Customer / product', 'Serial / invoice', 'Plan', 'Coverage period', 'Status']} rows={rows.map(item => [
      item.reference, <div className="cellstack" key={item.id}><b>{item.customerName}</b><small>{item.productName}</small></div>,
      <div className="cellstack" key={item.id + 'serial'}><b>{item.serial}</b><small>{item.invoiceNumber}</small></div>, item.planName,
      `${dateInIndia(item.startDate)} – ${dateInIndia(item.endDate)}`, <span className={`p7-status p7-${item.status.toLowerCase().replace(/ /g, '-')}`} key={item.id + 'status'}>{item.status}</span>
    ])} /> : <EmptyState text="No extended warranty registrations yet. Complete a sale for a serial-controlled product and select an eligible plan." />}
  </Panel>
}

export function WarrantyDirectory() {
  const { data } = useDemo()
  const [query, setQuery] = useState(''), [kind, setKind] = useState('All coverage'), [status, setStatus] = useState('All statuses'), [selected, setSelected] = useState<WarrantyView | null>(null), [ticketOpen, setTicketOpen] = useState(false)
  const rows = warrantyRows(data).filter(item => (kind === 'All coverage' || item.kind === kind) && (status === 'All statuses' || item.status === status) &&
    `${item.reference} ${item.customerName} ${item.productName} ${item.serial} ${item.invoiceNumber} ${item.planName}`.toLowerCase().includes(query.trim().toLowerCase()))
  const warrantySource = selected?.registration ? { customerId: selected.customerId, saleId: selected.registration.saleId, productId: selected.productId, serial: selected.serial, warrantyId: selected.registration.id } : {
    customerId: selected?.customerId, saleId: data.sales.find(item => item.invoiceNumber === selected?.invoiceNumber)?.id, productId: selected?.productId, serial: selected?.serial
  }
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Coverage register" title="Warranty directory" description="Search retailer registrations alongside illustrative manufacturer-term dates from the shared serial register." />
    <Panel title="Coverage records" meta={`${rows.length} matching record(s)`}>
      <div className="crm-toolbar"><SearchBar label="Search customer, product, invoice or serial" value={query} onChange={setQuery} /><Selector label="Filter coverage type" value={kind} options={['All coverage', 'Retailer Extended', 'Manufacturer']} onChange={setKind} /><Selector label="Filter warranty status" value={status} options={['All statuses', 'Active', 'Expiring Soon', 'Pending Registration', 'Expired', 'Cancelled']} onChange={setStatus} /></div>
      {rows.length ? <DataTable columns={['Reference', 'Customer', 'Product / serial', 'Invoice', 'Coverage type', 'Period', 'Status', 'Actions']} rows={rows.map(item => [
        <button className="crm-customer-link" key={item.id} onClick={() => setSelected(item)}><b>{item.reference}</b><small>{item.planName}</small></button>, item.customerName,
        <div className="cellstack" key={item.id + 'product'}><b>{item.productName}</b><small>{item.serial}</small></div>, item.invoiceNumber, item.kind,
        `${dateInIndia(item.startDate)} – ${dateInIndia(item.endDate)}`,
        <span className={`p7-status p7-${item.status.toLowerCase().replace(/ /g, '-')}`} key={item.id + 'status'}>{item.status}</span>,
        <Button key={item.id + 'open'} size="sm" variant="outline" onClick={() => setSelected(item)}>Details</Button>
      ])} /> : <EmptyState text="No warranty records match these filters. Register eligible sold serials or adjust the search." />}
    </Panel>
    <DetailDrawer open={!!selected} title={selected?.reference || 'Warranty details'} onClose={() => setSelected(null)}>
      {selected && <div className="p7-drawer"><div className="p7-drawer-intro"><span className={`p7-status p7-${selected.status.toLowerCase().replace(/ /g, '-')}`}>{selected.status}</span><p>{selected.kind} · {selected.planName}</p></div>
        <dl className="facts">{[['Customer', selected.customerName], ['Product', selected.productName], ['Serial number', selected.serial], ['Invoice', selected.invoiceNumber], ['Start date', dateInIndia(selected.startDate)], ['End date', dateInIndia(selected.endDate)], ['Plan price', planPrice(selected.pricePaise)], ['Coverage', selected.registration?.coverage || 'Illustrative manufacturer term from the shared serial record'], ['Exclusions', selected.exclusions]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <PrototypeNote>Coverage dates and terms are demo records. Manufacturer terms have not been independently verified.</PrototypeNote>
        <Button variant="outline" onClick={() => setTicketOpen(true)}>Create service ticket for this product</Button>
        <ServiceTicketDialog open={ticketOpen} onOpenChange={setTicketOpen} source={warrantySource} />
      </div>}
    </DetailDrawer>
  </div>
}

export function WarrantyCertificates() {
  const { data } = useDemo()
  const rows = warrantyRows(data)
  const [selectedId, setSelectedId] = useState('')
  const selected = rows.find(item => item.id === selectedId)
  return <div className="phase p7-page">
    <PageHeader eyebrow="After-sales / Documents" title="Warranty documents" description="Print a simple demo coverage summary for retailer registrations or linked manufacturer-term records." />
    <Panel title="Coverage documents" meta={`${rows.length} record(s)`}>
      {rows.length ? <DataTable columns={['Reference', 'Customer', 'Product / serial', 'Coverage', 'End date', 'Action']} rows={rows.map(item => [
        item.reference, item.customerName, <div className="cellstack" key={item.id + 'p'}><b>{item.productName}</b><small>{item.serial}</small></div>,
        item.kind, dateInIndia(item.endDate), <Button key={item.id + 'print'} size="sm" variant="outline" onClick={() => setSelectedId(item.id)}>Open document</Button>
      ])} /> : <EmptyState text="No coverage records are available to print." />}
    </Panel>
    {selected && <section className="p7-certificate" aria-label="Warranty coverage document">
      <header><div><b>ACS Electronics</b><small>After-sales demo record</small></div><Button variant="outline" onClick={() => window.print()}><Printer size={15} />Print / save PDF</Button></header>
      <p className="p7-document-label">{selected.kind === 'Retailer Extended' ? 'Retailer extended coverage summary' : 'Serial registry term summary'}</p>
      <h2>{selected.reference}</h2>
      <div className="p7-certificate-grid">{[['Customer', selected.customerName], ['Product', selected.productName], ['Serial number', selected.serial], ['Invoice', selected.invoiceNumber], ['Coverage plan', selected.planName], ['Coverage starts', dateInIndia(selected.startDate)], ['Coverage ends', dateInIndia(selected.endDate)], ['Record status', selected.status], ['Recorded price', planPrice(selected.pricePaise)]].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>
      <section><h3>Coverage summary</h3><p>{selected.registration?.coverage || 'The serial record contains an illustrative manufacturer warranty end date. Terms were not independently verified.'}</p><p><b>Exclusions:</b> {selected.exclusions}</p></section>
      <PrototypeNote>This is a fictional demo summary, not an OEM certificate, insurance policy, proof of purchase, approved claim or legally binding coverage document.</PrototypeNote>
    </section>}
  </div>
}
