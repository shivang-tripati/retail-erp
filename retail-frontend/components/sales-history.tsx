'use client'
import { useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useDemo } from './demo-provider'
import { useWorkspace } from './workspace'
import { PageHeader, DataTable, DetailDrawer, EmptyState, SearchBar, Selector, Confirmation } from './foundation'
import { Panel } from './analytics-controls'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import InvoicePreview from './pos/invoice-preview'
import { dateLabel, invoices, money, type Invoice } from '@/lib/demo-data'
import { dateInIndia, toAnalyticsInvoice, type Payment, type Sale } from '@/lib/phase3-data'
import { invoicePayments as paymentsForInvoice, paymentSnapshot } from '@/lib/finance'
import type { InventoryMovement } from '@/lib/phase4-data'
import type { Row } from '@/lib/demo-data'

type HistoryRecord = {
  id: string; invoiceNo: string; customer: string; mobile: string; store: string; salesperson: string; age: number
  gross: number; discount: number; tax: number; total: number; paid: number; due: number; status: string; sale?: Sale; legacy?: Invoice
}
const pageSize = 25
export default function SalesHistory() {
  const { data, transact } = useDemo(), { store } = useWorkspace()
  const initialStore = data.stores.find(item => item.name === store)?.id || 'All stores'
  const [query, setQuery] = useState(''), [dateRange, setDateRange] = useState('All dates'), [storeFilter, setStoreFilter] = useState(initialStore)
  const [statusFilter, setStatusFilter] = useState('All statuses'), [page, setPage] = useState(0), [selected, setSelected] = useState<HistoryRecord | null>(null)
  const [reverseTarget, setReverseTarget] = useState<Sale | null>(null), [reason, setReason] = useState(''), [error, setError] = useState('')
  const storeName = (id: string) => data.stores.find(item => item.id === id)?.name || id
  const all = useMemo<HistoryRecord[]>(() => {
    const old: HistoryRecord[] = invoices.map(invoice => {
      const customer = data.customers[invoice.customer - 1]
      return {
        id: invoice.id, invoiceNo: invoice.id, customer: customer?.name || `Customer ${invoice.customer}`, mobile: customer?.mobile || '',
        store: invoice.store, salesperson: 'Prince Tiwari', age: invoice.age, gross: invoice.gross, discount: invoice.gross - invoice.net, tax: 0,
        total: invoice.net, paid: invoice.paid, due: Math.max(0, invoice.net - invoice.paid),
        status: invoice.paid >= invoice.net ? 'Paid' : invoice.paid ? 'Partially paid' : 'Unpaid', legacy: invoice
      }
    })
    const current = data.sales.map(sale => ({
      ...sale, id: sale.id, invoiceNo: sale.invoiceNumber, customer: sale.customerName,
      mobile: data.customers.find(item => item.id === sale.customerId)?.mobile || '', store: sale.storeId, salesperson: sale.salesperson,
      age: toAnalyticsInvoice(sale).age, gross: sale.grossPaise / 100, discount: (sale.itemDiscountPaise + sale.cartDiscountPaise) / 100,
      tax: sale.taxPaise / 100, total: sale.totalPaise / 100, paid: sale.paidPaise / 100, due: sale.balancePaise / 100,
      status: sale.status === 'Reversed' ? 'Reversed' : sale.paymentStatus, sale
    }))
    return [...old, ...current]
  }, [data.customers, data.sales])
  const ageLimit = dateRange === 'Last 7 days' ? 7 : dateRange === 'Last 30 days' ? 30 : dateRange === 'Last 90 days' ? 90 : Infinity
  const filtered = all.filter(row =>
    row.age < ageLimit && (storeFilter === 'All stores' || row.store === storeFilter) &&
    (statusFilter === 'All statuses' || row.status === statusFilter) &&
    `${row.invoiceNo} ${row.customer} ${row.mobile} ${storeName(row.store)} ${row.salesperson}`.toLowerCase().includes(query.trim().toLowerCase()))
  const sorted = [...filtered].sort((a, b) => a.age - b.age || b.invoiceNo.localeCompare(a.invoiceNo))
  const visible = sorted.slice(page * pageSize, (page + 1) * pageSize)
  const selectedSale = selected?.sale
  const selectedCustomer = selectedSale ? data.customers.find(item => item.id === selectedSale.customerId) : undefined
  const selectedStore = selectedSale ? data.stores.find(item => item.id === selectedSale.storeId) : undefined
  const selectedPayments = selectedSale ? paymentsForInvoice(selectedSale, data) : []
  function show(row: HistoryRecord) { setSelected(row) }
  function reverse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!reverseTarget) return
    const clean = reason.trim()
    if (clean.length < 8) { setError('Enter an audit reason with at least 8 characters.'); return }
    try {
      const target = reverseTarget
      transact(current => {
        const sale = current.sales.find(item => item.id === target.id && item.status === 'Completed')
        if (!sale) throw new Error('This invoice is no longer available for reversal.')
        if (current.deliveries.some(order => order.saleId === sale.id && (order.items.some(line => line.dispatchedQuantity > 0 || line.deliveredQuantity > 0) ||
          ['Dispatched', 'In Transit', 'Out for Delivery', 'Delivered'].includes(order.status))))
          throw new Error('This sale has delivery activity. Complete an explicit delivery return workflow before reversing the invoice.')
        const returned = new Map<string, number>()
        for (const line of sale.lines) {
          const inventory = current.inventory.find(item => item.storeId === sale.storeId && item.productId === line.productId)
          if (!inventory) throw new Error(`Inventory record is missing for ${line.name}. No changes were made.`)
          returned.set(line.productId, (returned.get(line.productId) || 0) + line.quantity)
          for (const serial of line.serials) if (!current.serials.some(item => item.serial === serial && item.status === 'Sold' && item.invoiceId === sale.invoiceNumber))
            throw new Error(`Sold serial ${serial} could not be verified. No changes were made.`)
        }
        const now = new Date().toISOString()
        const movements: InventoryMovement[] = sale.lines.flatMap(line => {
          const product = current.products.find(item => item.id === line.productId)
          const serials = product?.serialRequired ? line.serials : ['']
          return serials.map(serial => ({ id: crypto.randomUUID(), reference: sale.invoiceNumber, productId: line.productId, sku: line.sku, serial, fromLocation: '', toLocation: sale.storeId, quantity: product?.serialRequired ? 1 : line.quantity, type: 'Sale Reversal', date: now, actor: 'Prince Tiwari', reason: clean }))
        })
        const cancelled = current.deliveries.filter(item => item.saleId === sale.id && item.status !== 'Cancelled')
        const cancelledInstallations = current.installations.filter(item => item.saleId === sale.id && item.status !== 'Cancelled')
        return {
          ...current,
          sales: current.sales.map(item => item.id === sale.id ? paymentSnapshot({ ...item, status: 'Reversed', reversalReason: clean, reversedAt: now, reversedBy: 'Prince Tiwari' }, current) : item),
          inventory: current.inventory.map(item => ({ ...item, quantity: item.quantity + (item.storeId === sale.storeId ? returned.get(item.productId) || 0 : 0) })),
          serials: current.serials.map(item => item.invoiceId === sale.invoiceNumber && item.status === 'Sold' ? { ...item, status: 'Available', invoiceId: undefined } : item),
          deliveries: current.deliveries.map(item => item.saleId === sale.id ? { ...item, status: 'Cancelled', updatedAt: now } : item),
          deliveryActivities: [...current.deliveryActivities, ...cancelled.map(item => ({ id: crypto.randomUUID(), deliveryId: item.id, type: 'Cancelled' as const, date: now, actor: 'Prince Tiwari', status: 'Cancelled' as const, notes: `Cancelled by invoice reversal: ${clean}` }))],
          installations: current.installations.map(item => item.saleId === sale.id ? { ...item, status: 'Cancelled' as const, cancellationReason: `Invoice reversal: ${clean}`, updatedAt: now } : item),
          installationActivities: [...current.installationActivities, ...cancelledInstallations.map(item => ({
            id: crypto.randomUUID(), installationId: item.id, action: 'Cancelled' as const, date: now, actor: 'Prince Tiwari', notes: `Cancelled by invoice reversal: ${clean}`
          }))],
          audit: [...current.audit, { id: crypto.randomUUID(), date: now, action: 'Sale reversed', actor: 'Prince Tiwari', reference: sale.invoiceNumber, detail: clean }],
          financialAudit: [...current.financialAudit, { id: crypto.randomUUID(), reference: sale.invoiceNumber, activity: 'Invoice reversed', date: now, actor: 'Prince Tiwari', reason: clean, customerId: sale.customerId, invoiceId: sale.invoiceNumber }],
          movements: [...current.movements, ...movements]
        }
      })
      toast.success(`Invoice ${target.invoiceNumber} reversed with an audit record`)
      setReverseTarget(null); setReason(''); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invoice reversal failed.') }
  }
  const rows = visible.map(record => [
    <button className="crm-customer-link" key={record.id} onClick={() => show(record)}><b>{record.invoiceNo}</b><small>{record.sale ? 'POS invoice' : 'Historical demo invoice'}</small></button>,
    <div className="cellstack" key={record.id + 'customer'}><b>{record.customer}</b><small>{record.mobile || 'No mobile on file'}</small></div>,
    storeName(record.store), record.salesperson, record.sale ? dateInIndia(record.sale.date) : `${dateLabel(record.age)} 2026`,
    money(record.gross), money(record.discount), money(record.tax), money(record.total), money(record.paid), money(record.due),
    <div key={record.id + 'status'} className="rowlinks"><span className={`signal ${record.status === 'Paid' ? 'Active' : record.status === 'Reversed' ? 'High' : 'Medium'}`}>{record.status}</span>{record.sale?.status === 'Completed' && <button onClick={() => { setReverseTarget(record.sale!); setReason(''); setError('') }}>Reverse</button>}</div>
  ])
  return <div className="phase">
    <PageHeader eyebrow="Sales / Transaction register" title="Sales history" description="Completed invoices, payment balances and reversal audit trail." />
    <Panel title="Invoice register" meta={`${filtered.length.toLocaleString('en-IN')} records · Most recent first`}>
      <div className="crm-toolbar"><SearchBar label="Search invoice, customer or mobile" value={query} onChange={value => { setQuery(value); setPage(0) }} /><Selector label="Sales date range" value={dateRange} options={['All dates', 'Last 7 days', 'Last 30 days', 'Last 90 days']} onChange={value => { setDateRange(value); setPage(0) }} /><Selector label="Filter sales by store" value={storeFilter === 'All stores' ? 'All stores' : storeName(storeFilter)} options={['All stores', ...data.stores.map(item => item.name)]} onChange={value => { setStoreFilter(data.stores.find(item => item.name === value)?.id || 'All stores'); setPage(0) }} /><Selector label="Filter by payment status" value={statusFilter} options={['All statuses', 'Paid', 'Partially paid', 'Unpaid', 'Reversed']} onChange={value => { setStatusFilter(value); setPage(0) }} /></div>
      {visible.length ? <DataTable columns={['Invoice number', 'Customer', 'Store', 'Salesperson', 'Date', 'Gross amount', 'Discount', 'Tax', 'Net amount', 'Amount paid', 'Balance due', 'Payment status / actions']} rows={rows} /> : <EmptyState text="No invoices match these filters." />}
      <div className="crm-pagination"><span>Showing {filtered.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</span><div><Button variant="outline" disabled={!page} onClick={() => setPage(value => Math.max(0, value - 1))}>Previous</Button><span>Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / pageSize))}</span><Button variant="outline" disabled={(page + 1) * pageSize >= filtered.length} onClick={() => setPage(value => value + 1)}>Next</Button></div></div>
    </Panel>
    <DetailDrawer open={!!selected && !selectedSale} title={selected?.invoiceNo || 'Invoice details'} onClose={() => setSelected(null)}>{selected && <><dl className="facts">{[['Customer', selected.customer], ['Customer mobile', selected.mobile || 'Not recorded'], ['Store', storeName(selected.store)], ['Salesperson', selected.salesperson], ['Date', `${dateLabel(selected.age)} 2026`], ['Gross amount', money(selected.gross)], ['Discount', money(selected.discount)], ['Tax', money(selected.tax)], ['Invoice total', money(selected.total)], ['Amount paid', money(selected.paid)], ['Balance due', money(selected.due)], ['Status', selected.status]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="crm-note">Historical demo invoices contain no line-level product or serial details.</p></>}</DetailDrawer>
    <Dialog open={!!selectedSale && !!selectedCustomer} onOpenChange={open => !open && setSelected(null)}><DialogContent className="invoice-dialog"><DialogTitle className="sr-only">Invoice {selectedSale?.invoiceNumber}</DialogTitle>{selectedSale && selectedCustomer && <InvoicePreview sale={selectedSale} customer={selectedCustomer} store={selectedStore as Row | undefined} payments={selectedPayments as Payment[]} company={data.settings.Company} />}</DialogContent></Dialog>
    <Dialog open={!!reverseTarget} onOpenChange={open => !open && setReverseTarget(null)}><DialogContent><DialogTitle>Reverse invoice {reverseTarget?.invoiceNumber}?</DialogTitle><DialogDescription>This records an audit reason, restores demo stock and makes sold serials available again. Existing payment entries remain in the audit history.</DialogDescription>
      <form className="crm-form" onSubmit={reverse}><label className="crm-field">Reason for reversal<textarea required minLength={8} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="For example: duplicate counter transaction" /></label>
        {error && <p role="alert" className="crm-error">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setReverseTarget(null)}>Cancel</Button><Button type="submit" variant="destructive">Confirm reversal</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>
}
