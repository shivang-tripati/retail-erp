'use client'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, DataTable, EmptyState, SearchBar, Selector, StatusBadge } from '../foundation'
import { Panel } from '../analytics-controls'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '../ui/dialog'
import { useDemo } from '../demo-provider'
import { useWorkspace } from '../workspace'
import { activeInvoices, allocatedPaise, financeReferenceDate, invoiceFinance, inDateRange, paymentIsActive, paymentSnapshot, paymentStoreId, unallocatedPaise } from '@/lib/finance'
import type { Payment } from '@/lib/phase3-data'
import { currency } from '@/lib/phase3-data'
import { FinanceMetrics, dateLabel, dateTimeLabel, financeDateRanges, financePaymentModes, makeFinanceId, parseAmountPaise, paymentReferenceRequired, storeLabel, toDemoDate } from './shared'

const blankDraft = () => ({ customerId: '', storeId: '', date: financeReferenceDate, amount: '', mode: 'Cash', reference: '', financier: '', collectedBy: 'Prince Tiwari', notes: '' })
type Draft = ReturnType<typeof blankDraft>

export function Collections() {
  const { data, transact } = useDemo(), { store: workspaceStore } = useWorkspace()
  const initialStore = data.stores.find(item => item.name === workspaceStore)?.id || data.stores[0]?.id || ''
  const [dialog, setDialog] = useState(false), [draft, setDraft] = useState<Draft>(blankDraft()), [allocations, setAllocations] = useState<Record<string, string>>({})
  const [error, setError] = useState(''), [submitting, setSubmitting] = useState(false), [range, setRange] = useState('All dates'), [storeFilter, setStoreFilter] = useState('All stores'), [query, setQuery] = useState('')
  const submitRef = useRef(false)
  const customers = data.customers.filter(customer => customer.status === 'Active')
  const customerInvoices = activeInvoices(data).filter(item => item.sale.customerId === draft.customerId && item.balancePaise > 0)
  const amountPaise = parseAmountPaise(draft.amount)
  const invalidAllocations = Object.values(allocations).some(value => value.trim() && parseAmountPaise(value) <= 0)
  const selectedAllocations = Object.entries(allocations).map(([invoiceId, value]) => ({ invoiceId, amountPaise: parseAmountPaise(value) })).filter(item => item.amountPaise > 0)
  const allocationTotal = selectedAllocations.reduce((sum, item) => sum + item.amountPaise, 0)
  const filteredPayments = data.payments.filter(payment => inDateRange(payment.date, range) &&
    (storeFilter === 'All stores' || paymentStoreId(payment, data) === storeFilter) && (!query || `${payment.reference} ${payment.invoiceId} ${payment.customerId} ${payment.mode}`.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => b.date.localeCompare(a.date))
  const totalCollected = filteredPayments.filter(paymentIsActiveForData).reduce((sum, payment) => sum + payment.amountPaise, 0)
  function paymentIsActiveForData(payment: Payment) { return paymentIsActive(payment, data) }
  function openForm() {
    setDraft({ ...blankDraft(), storeId: initialStore }); setAllocations({}); setError(''); setDialog(true)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitRef.current) return
    setError('')
    const customer = data.customers.find(item => item.id === draft.customerId)
    if (!customer) { setError('Select a customer before recording a collection.'); return }
    if (!draft.storeId || !data.stores.some(item => item.id === draft.storeId)) { setError('Select a valid collection store.'); return }
    if (!draft.date || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) { setError('Enter a positive amount with up to two decimal places.'); return }
    if (paymentReferenceRequired(draft.mode) && !draft.reference.trim()) { setError('Enter a payment reference for this payment mode.'); return }
    if (draft.mode === 'Financing / EMI' && !draft.financier.trim()) { setError('Enter a fictional financier name for EMI collections.'); return }
    if (invalidAllocations) { setError('Each invoice allocation must be a positive INR amount with up to two decimal places.'); return }
    if (allocationTotal > amountPaise) { setError('Invoice allocations cannot exceed the collection amount. The remainder can stay as an advance.'); return }
    if (!draft.collectedBy.trim()) { setError('Select who recorded the collection.'); return }
    submitRef.current = true; setSubmitting(true)
    try {
      transact(current => {
        const selectedCustomer = current.customers.find(item => item.id === draft.customerId)
        if (!selectedCustomer) throw new Error('Customer record changed before confirmation.')
        const allocationsToCreate = selectedAllocations.map(selected => {
          const sale = current.sales.find(item => item.invoiceNumber === selected.invoiceId && item.status === 'Completed')
          if (!sale || sale.customerId !== selectedCustomer.id) throw new Error('An allocation invoice does not belong to this customer.')
          const currentBalance = invoiceFinance(sale, current).balancePaise
          if (selected.amountPaise > currentBalance) throw new Error(`${sale.invoiceNumber} no longer has the entered balance available.`)
          return { ...selected, sale }
        })
        if (allocationsToCreate.reduce((sum, item) => sum + item.amountPaise, 0) > amountPaise) throw new Error('The allocated amount exceeds the collection amount.')
        const now = new Date().toISOString(), paymentId = makeFinanceId('PAY'), payment: Payment = {
          id: paymentId, invoiceId: '', customerId: selectedCustomer.id, date: toDemoDate(draft.date), amountPaise,
          mode: draft.mode, reference: draft.reference.trim(), financier: draft.mode === 'Financing / EMI' ? draft.financier.trim() : '',
          storeId: draft.storeId, collectedBy: draft.collectedBy.trim(), notes: draft.notes.trim()
        }
        const created = allocationsToCreate.map((item, index) => ({ id: makeFinanceId('ALLOC'), paymentId, invoiceId: item.invoiceId, amountPaise: item.amountPaise, createdAt: now, createdBy: draft.collectedBy.trim(), index }))
        const next = { ...current, payments: [...current.payments, payment], paymentAllocations: [...current.paymentAllocations, ...created.map(({ index, ...allocation }) => allocation)] }
        const linked = new Set(allocationsToCreate.map(item => item.invoiceId))
        return {
          ...next, sales: current.sales.map(sale => linked.has(sale.invoiceNumber) ? paymentSnapshot({ ...sale, paymentIds: [...sale.paymentIds, paymentId] }, next) : sale),
          financialAudit: [...current.financialAudit,
          { id: makeFinanceId('FAUD'), reference: payment.reference || payment.id, activity: 'Payment recorded' as const, date: now, actor: draft.collectedBy.trim(), reason: draft.notes.trim() || 'Demo collection recorded', customerId: selectedCustomer.id },
          ...created.map(({ invoiceId, amountPaise: allocatedAmount, index }) => ({ id: makeFinanceId('FAUD'), reference: payment.reference || payment.id, activity: 'Payment allocated' as const, date: now, actor: draft.collectedBy.trim(), reason: `${currency(allocatedAmount)} allocated to invoice ${invoiceId} · allocation ${index + 1}`, customerId: selectedCustomer.id, invoiceId }))
          ]
        }
      })
      toast.success(allocationTotal < amountPaise ? 'Collection recorded; remaining amount is an unallocated advance.' : 'Collection recorded and allocated.')
      setDialog(false); setDraft(blankDraft()); setAllocations({})
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Collection was not recorded. No financial records were changed.') }
    finally { submitRef.current = false; setSubmitting(false) }
  }
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Collections" title="Collection entry" description="Record an incoming payment and explicitly allocate it to one or more invoices—or keep it as an unallocated customer advance.">
      <Button onClick={openForm}><Plus size={15} />Record collection</Button>
    </PageHeader>
    <FinanceMetrics items={[{ label: 'Payments in view', value: String(filteredPayments.length) }, { label: 'Valid collection total', value: currency(totalCollected) }, { label: 'Unallocated advances', value: currency(filteredPayments.filter(payment => paymentIsActive(payment, data)).reduce((sum, payment) => sum + unallocatedPaise(payment, data), 0)) }, { label: 'Allocation policy', value: 'Explicit only' }]} />
    <Panel title="Collection register" meta="New collections append payment and allocation records; previous allocations are never overwritten">
      <div className="crm-toolbar finance-toolbar"><SearchBar label="Search payment, customer or invoice" value={query} onChange={setQuery} /><Selector label="Collection date range" value={range} options={financeDateRanges} onChange={setRange} /><Selector label="Filter collections by store" value={storeFilter === 'All stores' ? 'All stores' : storeLabel(storeFilter, data.stores)} options={['All stores', ...data.stores.map(item => item.name)]} onChange={value => setStoreFilter(data.stores.find(item => item.name === value)?.id || 'All stores')} /></div>
      {filteredPayments.length ? <DataTable columns={['Reference', 'Customer', 'Store', 'Date', 'Mode', 'Payment amount', 'Allocated', 'Unallocated', 'Status']} rows={filteredPayments.map(payment => [
        payment.reference || payment.id, data.customers.find(item => item.id === payment.customerId)?.name || payment.customerId, storeLabel(paymentStoreId(payment, data), data.stores), dateTimeLabel(payment.date), payment.mode, currency(payment.amountPaise), currency(allocatedPaise(payment, data)), currency(unallocatedPaise(payment, data)),
        <StatusBadge key={payment.id + 'status'}>{paymentIsActive(payment, data) ? 'Recorded' : 'Reversed'}</StatusBadge>
      ])} /> : <EmptyState text="No collection records match these filters." />}
      <p className="crm-note">A customer advance stays unallocated and does not reduce receivables until a separate allocation is confirmed.</p>
    </Panel>
    <Dialog open={dialog} onOpenChange={open => { if (!open && !submitting) setDialog(false) }}><DialogContent className="crm-dialog finance-entry-dialog">
      <DialogTitle>Record a collection</DialogTitle><DialogDescription>Enter the payment details, then allocate exact amounts to open invoices. Unallocated remainder remains a customer advance.</DialogDescription>
      <form className="crm-form" onSubmit={submit} noValidate>
        <div className="crm-form-grid">
          <label className="crm-field">Customer<span>*</span><select required value={draft.customerId} onChange={event => { setDraft(current => ({ ...current, customerId: event.target.value })); setAllocations({}) }}><option value="">Select customer</option>{customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.mobile} · {customer.id}</option>)}</select></label>
          <label className="crm-field">Collection store<span>*</span><select required value={draft.storeId} onChange={event => setDraft(current => ({ ...current, storeId: event.target.value }))}><option value="">Select store</option>{data.stores.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="crm-field">Collection date<span>*</span><input type="date" required value={draft.date} onChange={event => setDraft(current => ({ ...current, date: event.target.value }))} /></label>
          <label className="crm-field">Amount (INR)<span>*</span><input inputMode="decimal" required value={draft.amount} onChange={event => setDraft(current => ({ ...current, amount: event.target.value }))} placeholder="0.00" /></label>
          <label className="crm-field">Payment mode<span>*</span><select value={draft.mode} onChange={event => setDraft(current => ({ ...current, mode: event.target.value }))}>{financePaymentModes.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="crm-field">Payment reference{paymentReferenceRequired(draft.mode) && <span>*</span>}<input required={paymentReferenceRequired(draft.mode)} value={draft.reference} onChange={event => setDraft(current => ({ ...current, reference: event.target.value }))} placeholder="Required for UPI, card, bank transfer and EMI" /></label>
          {draft.mode === 'Financing / EMI' && <label className="crm-field">Financier name<span>*</span><input required value={draft.financier} onChange={event => setDraft(current => ({ ...current, financier: event.target.value }))} placeholder="Fictional provider" /></label>}
          <label className="crm-field">Collected by<span>*</span><select value={draft.collectedBy} onChange={event => setDraft(current => ({ ...current, collectedBy: event.target.value }))}>{data.users.filter(user => user.status === 'Active').map(user => <option key={user.id}>{user.name}</option>)}</select></label>
          <label className="crm-field crm-field-wide">Notes<input value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Optional demo-only notes" /></label>
        </div>
        {draft.customerId && <div className="finance-allocation-list"><div className="finance-allocation-heading"><div><h3>Invoice allocations</h3><p>Enter an amount per invoice. Leave blank to keep that amount as an advance.</p></div><b>Allocated {currency(allocationTotal)} / {currency(amountPaise)}</b></div>
          {customerInvoices.length ? customerInvoices.map(item => <label key={item.sale.id} className="finance-allocation-line"><span><b>{item.sale.invoiceNumber}</b><small>{dateLabel(item.sale.date)} · due {dateLabel(item.dueDate)} · balance {currency(item.balancePaise)}</small></span><input aria-label={`Allocate to ${item.sale.invoiceNumber}`} inputMode="decimal" value={allocations[item.sale.invoiceNumber] || ''} onChange={event => setAllocations(current => ({ ...current, [item.sale.invoiceNumber]: event.target.value }))} placeholder="0.00" /></label>) : <p className="crm-note">This customer has no open completed invoices. Any amount will remain an unallocated advance.</p>}
          <p className="crm-note">Unallocated after this entry: {currency(Math.max(0, amountPaise - allocationTotal))}. Allocation cannot exceed the selected invoice balance.</p>
        </div>}
        {error && <p role="alert" className="crm-error">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={submitting} onClick={() => setDialog(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? 'Recording…' : 'Record collection'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>
}

export function PaymentAllocation() {
  const { data, transact } = useDemo()
  const authorized = data.users.filter(user => user.status === 'Active' && (user.role === 'Corporate Admin' || user.role === 'Finance Executive'))
  const [paymentId, setPaymentId] = useState(''), [actor, setActor] = useState(authorized[0]?.name || ''), [allocations, setAllocations] = useState<Record<string, string>>({}), [error, setError] = useState('')
  const selectedPayment = data.payments.find(item => item.id === paymentId)
  const remaining = selectedPayment ? unallocatedPaise(selectedPayment, data) : 0
  const openInvoices = selectedPayment ? activeInvoices(data).filter(item => item.sale.customerId === selectedPayment.customerId && item.balancePaise > 0) : []
  const invalidAllocations = Object.values(allocations).some(value => value.trim() && parseAmountPaise(value) <= 0)
  const selected = Object.entries(allocations).map(([invoiceId, value]) => ({ invoiceId, amountPaise: parseAmountPaise(value) })).filter(item => item.amountPaise > 0)
  const allocationTotal = selected.reduce((sum, item) => sum + item.amountPaise, 0)
  const advances = data.payments.filter(payment => paymentIsActive(payment, data) && unallocatedPaise(payment, data) > 0)
  const records = useMemo(() => data.payments.map(payment => ({ payment, allocated: allocatedPaise(payment, data), unallocated: unallocatedPaise(payment, data) })).sort((a, b) => b.payment.date.localeCompare(a.payment.date)), [data])
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!selectedPayment || !paymentIsActive(selectedPayment, data)) { setError('Select an active payment with an unallocated balance.'); return }
    if (!authorized.some(user => user.name === actor)) { setError('Choose a Corporate Admin or Finance Executive demo user to simulate allocation authority.'); return }
    if (invalidAllocations) { setError('Each allocation must be a positive INR amount with up to two decimal places.'); return }
    if (!selected.length || allocationTotal <= 0) { setError('Enter at least one invoice allocation.'); return }
    if (allocationTotal > remaining) { setError('Allocated amount cannot exceed the payment’s unallocated balance.'); return }
    try {
      transact(current => {
        const payment = current.payments.find(item => item.id === paymentId)
        if (!payment || !paymentIsActive(payment, current)) throw new Error('Payment changed before allocation. No records were changed.')
        const currentRemaining = unallocatedPaise(payment, current)
        const prepared = selected.map(item => {
          const sale = current.sales.find(row => row.invoiceNumber === item.invoiceId && row.status === 'Completed')
          if (!sale || sale.customerId !== payment.customerId) throw new Error('An invoice does not belong to this payment customer.')
          if (item.amountPaise > invoiceFinance(sale, current).balancePaise) throw new Error(`${sale.invoiceNumber} no longer has this balance available.`)
          return { ...item, sale }
        })
        if (prepared.reduce((sum, item) => sum + item.amountPaise, 0) > currentRemaining) throw new Error('The available advance changed before confirmation.')
        const now = new Date().toISOString()
        const additions = prepared.map(item => ({ id: makeFinanceId('ALLOC'), paymentId: payment.id, invoiceId: item.invoiceId, amountPaise: item.amountPaise, createdAt: now, createdBy: actor }))
        const next = { ...current, paymentAllocations: [...current.paymentAllocations, ...additions] }
        const linked = new Set(prepared.map(item => item.invoiceId))
        return {
          ...next, sales: current.sales.map(sale => linked.has(sale.invoiceNumber) ? paymentSnapshot({ ...sale, paymentIds: [...sale.paymentIds, payment.id] }, next) : sale),
          financialAudit: [...current.financialAudit, ...prepared.map((item, index) => ({ id: makeFinanceId('FAUD'), reference: payment.reference || payment.id, activity: 'Payment allocated' as const, date: now, actor, reason: `${currency(item.amountPaise)} allocated to ${item.invoiceId} · allocation ${index + 1}`, customerId: payment.customerId, invoiceId: item.invoiceId }))]
        }
      })
      toast.success('Advance allocated; the payment record and prior allocations were preserved')
      setPaymentId(''); setAllocations({})
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Allocation could not be saved. No records were changed.') }
  }
  return <div className="phase finance-page">
    <PageHeader eyebrow="Finance / Payment allocation" title="Payment allocation" description="Apply a customer advance to open invoices with an explicit, auditable allocation. Existing allocations cannot be overwritten." />
    <FinanceMetrics items={[{ label: 'Unallocated advances', value: String(advances.length) }, { label: 'Available to allocate', value: currency(advances.reduce((sum, item) => sum + unallocatedPaise(item, data), 0)) }, { label: 'Allocation method', value: 'Append only' }, { label: 'Authorized demo roles', value: 'Finance / Admin' }]} />
    <div className="finance-two-column">
      <Panel title="Allocate an advance" meta="Only an active Corporate Admin or Finance Executive demo user may submit">
        <form className="crm-form" onSubmit={submit} noValidate>
          <label className="crm-field">Unallocated payment<span>*</span><select value={paymentId} onChange={event => { setPaymentId(event.target.value); setAllocations({}); setError('') }}><option value="">Select an advance</option>{advances.map(payment => <option key={payment.id} value={payment.id}>{payment.reference || payment.id} · {data.customers.find(item => item.id === payment.customerId)?.name} · available {currency(unallocatedPaise(payment, data))}</option>)}</select></label>
          <label className="crm-field">Authorized demo user<span>*</span><select value={actor} onChange={event => setActor(event.target.value)}>{authorized.map(user => <option key={user.id}>{user.name}</option>)}</select></label>
          {selectedPayment && <><p className="finance-prototype-note">Customer: {data.customers.find(item => item.id === selectedPayment.customerId)?.name} · Available advance: {currency(remaining)} · New allocation: {currency(allocationTotal)}</p>
            <div className="finance-allocation-list">{openInvoices.length ? openInvoices.map(item => <label key={item.sale.id} className="finance-allocation-line"><span><b>{item.sale.invoiceNumber}</b><small>Due {dateLabel(item.dueDate)} · balance {currency(item.balancePaise)}</small></span><input aria-label={`Allocate advance to ${item.sale.invoiceNumber}`} inputMode="decimal" value={allocations[item.sale.invoiceNumber] || ''} onChange={event => setAllocations(current => ({ ...current, [item.sale.invoiceNumber]: event.target.value }))} placeholder="0.00" /></label>) : <p className="crm-note">This customer has no active invoice balance.</p>}</div>
          </>}
          {error && <p className="crm-error" role="alert">{error}</p>}
          <Button type="submit" disabled={!selectedPayment || allocationTotal <= 0}>Allocate selected amount</Button>
        </form>
      </Panel>
      <Panel title="Payment allocation register" meta="The unallocated amount is never applied automatically">
        {records.length ? <DataTable columns={['Reference', 'Customer', 'Payment amount', 'Allocated', 'Unallocated', 'Allocations']} rows={records.map(({ payment, allocated, unallocated }) => [
          payment.reference || payment.id, data.customers.find(item => item.id === payment.customerId)?.name || payment.customerId, currency(payment.amountPaise), currency(allocated), currency(unallocated),
          data.paymentAllocations.filter(item => item.paymentId === payment.id).map(item => `${item.invoiceId}: ${currency(item.amountPaise)}`).join(' · ') || 'Customer advance'
        ])} /> : <EmptyState text="No payments to allocate." />}
      </Panel>
    </div>
    <p className="crm-note">A confirmed allocation is an additional ledger record. To correct it, reverse or adjust the payment explicitly; this prototype does not edit prior allocation rows.</p>
  </div>
}
