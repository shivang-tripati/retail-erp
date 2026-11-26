'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PageHeader, DataTable, EmptyState, SearchBar, Selector, Confirmation, DetailDrawer, ScanField } from '../foundation'
import { Panel } from '../analytics-controls'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '../ui/dialog'
import { useDemo } from '../demo-provider'
import { currency } from '@/lib/phase3-data'
import { type GRN, type GRNLine, type InventoryMovement, warehouseLocationId, warehouseLocationName } from '@/lib/phase4-data'
import { Field, locationName, parsePaise, SelectField } from './shared'

const locations = (stores: { id: string; name: string }[]) => [{ value: warehouseLocationId, label: warehouseLocationName }, ...stores.map(store => ({ value: store.id, label: store.name }))]
const serialList = (value: string) => [...new Set(value.split(/[,\s]+/).map(item => item.trim()).filter(Boolean))]
const onHand = (inventory: { productId: string; storeId: string; quantity: number }[], productId: string, storeId: string) => inventory.find(item => item.productId === productId && item.storeId === storeId)?.quantity || 0
type GRNDraftLine = { productId: string; expected: string; received: string; damaged: string; purchasePrice: string }
const moneyField = (value: number) => ((value || 0) / 100).toFixed(2)
function GRNEditor({ onCancel, onCreate }: { onCancel: () => void; onCreate: (supplier: string, invoice: string, items: GRNLine[], notes: string) => void }) {
  const { data } = useDemo()
  const [supplier, setSupplier] = useState('Northstar Distribution'), [invoice, setInvoice] = useState(''), [notes, setNotes] = useState('')
  const [productId, setProductId] = useState(data.products.find(item => item.status === 'Active')?.id || ''), [expected, setExpected] = useState('1'), [received, setReceived] = useState('1'), [damaged, setDamaged] = useState('0'), [purchasePrice, setPurchasePrice] = useState(moneyField(data.products[0]?.purchasePricePaise || 0))
  const [items, setItems] = useState<GRNLine[]>([]), [error, setError] = useState('')
  const product = data.products.find(item => item.id === productId)
  function addItem() {
    const exp = Number(expected), rec = Number(received), damage = Number(damaged), price = parsePaise(purchasePrice)
    if (!product || !Number.isInteger(exp) || exp < 1 || !Number.isInteger(rec) || rec < 0 || rec > exp || !Number.isInteger(damage) || damage < 0 || damage > rec || !Number.isFinite(price) || price < 0) { setError('Enter valid expected, received and damaged whole-unit quantities and a non-negative purchase price.'); return }
    if (items.some(item => item.productId === product.id)) { setError('Each product can be added once per receipt.'); return }
    setItems(current => [...current, { productId: product.id, expectedQuantity: exp, receivedQuantity: rec, damagedQuantity: damage, purchasePricePaise: price, serials: [], damagedSerials: [] }]); setError('')
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!supplier.trim() || !invoice.trim() || !items.length) { setError('Enter the supplier, supplier invoice reference, and at least one product.'); return } onCreate(supplier.trim(), invoice.trim(), items, notes.trim()) }
  return <form className="crm-form" onSubmit={submit} noValidate><div className="crm-form-grid">
    <Field label="Supplier" value={supplier} onChange={setSupplier} />
    <Field label="Supplier invoice reference" value={invoice} onChange={setInvoice} />
    <SelectField label="Product" value={productId} onChange={value => { setProductId(value); const item = data.products.find(row => row.id === value); if (item) setPurchasePrice(moneyField(item.purchasePricePaise)) }} options={data.products.filter(item => item.status === 'Active').map(item => ({ value: item.id, label: `${item.name} · ${item.sku}` }))} />
    <Field label="Expected quantity" value={expected} onChange={value => setExpected(value)} type="number" step="1" />
    <Field label="Received quantity" value={received} onChange={value => setReceived(value)} type="number" step="1" />
    <Field label="Damaged quantity" value={damaged} onChange={value => setDamaged(value)} type="number" step="1" />
    <Field label="Purchase price per unit (₹)" value={purchasePrice} onChange={setPurchasePrice} type="number" step="0.01" />
    <Field label="Receipt notes" value={notes} onChange={setNotes} required={false} />
  </div><Button type="button" variant="outline" onClick={addItem}>Add product line</Button>
    {items.length > 0 && <DataTable columns={['Product', 'Expected', 'Received', 'Damaged', 'Purchase price', 'Serial tracking', 'Action']} rows={items.map((item, index) => { const selected = data.products.find(row => row.id === item.productId)!; return [selected.name, item.expectedQuantity, item.receivedQuantity, item.damagedQuantity, currency(item.purchasePricePaise), selected.serialRequired ? 'Required before receipt' : 'Not required', <button className="textlink" key={index} type="button" onClick={() => setItems(current => current.filter((_, i) => i !== index))}>Remove</button>] })} />}
    {error && <p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">Save GRN draft</Button></DialogFooter></form>
}

export function GRNManagement() {
  const { data, transact } = useDemo()
  const router = useRouter()
  const [open, setOpen] = useState(false), [receive, setReceive] = useState<GRN | undefined>(), [detail, setDetail] = useState<GRN | undefined>(), [error, setError] = useState('')
  function create(supplier: string, invoice: string, items: GRNLine[], notes: string) {
    try {
      transact(current => {
        if (current.grns.some(item => item.supplierInvoice.toLowerCase() === invoice.toLowerCase())) throw new Error('Supplier invoice reference is already recorded.')
        const now = new Date().toISOString(), id = `GRN-${now.replace(/\D/g, '').slice(0, 14)}`
        return { ...current, grns: [...current.grns, { id, supplier, supplierInvoice: invoice, receivingLocation: warehouseLocationId, status: 'Draft', items, createdAt: now, receivedAt: '', createdBy: 'Prince Tiwari', notes }] }
      })
      toast.success('GRN draft saved; no stock has been received yet.')
      setOpen(false)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'GRN could not be saved.') }
  }
  function receiveGRN() {
    if (!receive) return
    try {
      transact(current => {
        const grn = current.grns.find(item => item.id === receive.id && item.status === 'Draft')
        if (!grn) throw new Error('This GRN has already been received or is no longer available.')
        const receivedLines = grn.items.map(line => {
          const product = current.products.find(item => item.id === line.productId)
          if (!product) throw new Error('A GRN product no longer exists.')
          if (!Number.isInteger(line.expectedQuantity) || line.expectedQuantity < 1 || !Number.isInteger(line.receivedQuantity) || line.receivedQuantity < 0 || line.receivedQuantity > line.expectedQuantity || line.damagedQuantity < 0 || line.damagedQuantity > line.receivedQuantity) throw new Error(`Received, damaged or short quantity is invalid for ${product.name}.`)
          const sellable = line.receivedQuantity - line.damagedQuantity
          const damagedSerials = line.damagedSerials || []
          if (product.serialRequired && (line.serials.length !== sellable || damagedSerials.length !== line.damagedQuantity || new Set([...line.serials, ...damagedSerials]).size !== line.receivedQuantity)) throw new Error(`Scan ${sellable} sellable and ${line.damagedQuantity} damaged serials for ${product.name} before receipt.`)
          if ([...line.serials, ...damagedSerials].some(serial => current.serials.some(record => record.serial.toLowerCase() === serial.toLowerCase()))) throw new Error(`A scanned serial for ${product.name} is already registered.`)
          return { ...line, sellable, product }
        })
        const now = new Date().toISOString(), grnMovements: InventoryMovement[] = receivedLines.flatMap(line => {
          const serials = line.product.serialRequired ? line.serials : ['']
          return serials.map(serial => ({ id: crypto.randomUUID(), reference: grn.id, productId: line.product.id, sku: line.product.sku, serial, fromLocation: 'SUPPLIER', toLocation: warehouseLocationId, quantity: line.product.serialRequired ? 1 : line.sellable, type: 'Purchase Receipt' as const, date: now, actor: 'Prince Tiwari', reason: `Supplier invoice ${grn.supplierInvoice}` }))
        })
        const quantityUpdates = new Map(receivedLines.map(line => [line.productId, line.sellable]))
        for (const line of receivedLines) if (!current.inventory.some(row => row.productId === line.productId && row.storeId === warehouseLocationId)) throw new Error(`Warehouse inventory record is missing for ${line.product.name}.`)
        const newSerials = receivedLines.flatMap(line => line.product.serialRequired ? [
          ...line.serials.map(serial => ({ serial, productId: line.product.id, storeId: warehouseLocationId, status: 'Available' as const, grnReference: grn.id, purchaseDate: now, warrantyUntil: new Date(Date.now() + 365 * 86400000).toISOString() })),
          ...(line.damagedSerials || []).map(serial => ({ serial, productId: line.product.id, storeId: warehouseLocationId, status: 'Unavailable' as const, grnReference: grn.id, purchaseDate: now, warrantyUntil: '' }))
        ] : [])
        return {
          ...current,
          grns: current.grns.map(item => item.id === grn.id ? { ...item, status: 'Received', receivedAt: now } : item),
          inventory: current.inventory.map(row => row.storeId === warehouseLocationId ? { ...row, quantity: row.quantity + (quantityUpdates.get(row.productId) || 0) } : row),
          products: current.products.map(product => { const line = receivedLines.find(item => item.productId === product.id); return line ? { ...product, purchasePricePaise: line.purchasePricePaise } : product }),
          serials: [...current.serials, ...newSerials],
          movements: [...current.movements, ...grnMovements],
          audit: [...current.audit, { id: crypto.randomUUID(), date: now, action: 'Goods receipt confirmed', actor: 'Prince Tiwari', reference: grn.id, detail: `${grn.supplier} · ${grn.supplierInvoice}` }]
        }
      })
      toast.success(`GRN ${receive.id} received into the central warehouse`)
      setReceive(undefined); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'GRN receipt failed. No stock was changed.') }
  }
  const sorted = [...data.grns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return <div className="phase">
    <PageHeader eyebrow="Warehouse / Receiving" title="Goods receipt notes" description="Capture supplier receipts, shortages, damage and serialized units before adding accepted stock to the central warehouse."><Button onClick={() => setOpen(true)}>Create GRN</Button></PageHeader>
    <Panel title="Goods receipts" meta={`${sorted.length} records · Drafts do not change on-hand stock`}>
      {sorted.length ? <DataTable columns={['GRN reference', 'Supplier', 'Supplier invoice', 'Receiving location', 'Lines', 'Created', 'Status', 'Actions']} rows={sorted.map(grn => [
        grn.id, grn.supplier, grn.supplierInvoice, locationName(grn.receivingLocation, data.stores), grn.items.length, new Date(grn.createdAt).toLocaleDateString('en-IN'), <span className={`signal ${grn.status === 'Received' ? 'Active' : 'Medium'}`} key={grn.id + 'status'}>{grn.status}</span>,
        <div className="rowlinks" key={grn.id + 'actions'}>{grn.status === 'Draft' && <><button onClick={() => { setReceive(grn); setError('') }}>Confirm receipt</button><button onClick={() => router.push('/warehouse/serial-scanning')}>Scan serials</button></>}{grn.status === 'Received' && <button onClick={() => setDetail(grn)}>View</button>}</div>
      ])} /> : <EmptyState text="No goods receipts yet. Create a draft to start receiving stock." />}
      <p className="crm-note">Initial seeded stock is represented by illustrative opening receipts. Confirmed GRNs append movements and serial records; historical movements remain unchanged.</p>
    </Panel>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="crm-dialog"><DialogTitle>Create goods receipt</DialogTitle><DialogDescription>Save a draft first, scan serial-controlled items, then confirm the receipt.</DialogDescription><GRNEditor onCancel={() => setOpen(false)} onCreate={create} /></DialogContent></Dialog>
    <Dialog open={!!receive} onOpenChange={open => { if (!open) { setReceive(undefined); setError('') } }}><DialogContent><DialogTitle>Confirm receipt {receive?.id}?</DialogTitle><DialogDescription>Accepted quantities will be added to {warehouseLocationName}. Damaged items are excluded from sellable stock. This action cannot be submitted twice.</DialogDescription>{error && <p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => { setReceive(undefined); setError('') }}>Cancel</Button><Button onClick={receiveGRN}>Confirm receipt</Button></DialogFooter></DialogContent></Dialog>
    <DetailDrawer title={detail ? `Goods receipt ${detail.id}` : 'Goods receipt'} open={!!detail} onClose={() => setDetail(undefined)}>
      {detail && <><dl><div><dt>Supplier</dt><dd>{detail.supplier}</dd></div><div><dt>Supplier invoice</dt><dd>{detail.supplierInvoice}</dd></div><div><dt>Receiving location</dt><dd>{locationName(detail.receivingLocation, data.stores)}</dd></div><div><dt>Received</dt><dd>{detail.receivedAt ? new Date(detail.receivedAt).toLocaleString('en-IN') : '—'}</dd></div><div><dt>Notes</dt><dd>{detail.notes || '—'}</dd></div></dl><DataTable columns={['Product', 'Expected', 'Received', 'Damaged', 'Sellable', 'Unit cost', 'Scanned serials']} rows={detail.items.map(line => [data.products.find(item => item.id === line.productId)?.name || line.productId, line.expectedQuantity, line.receivedQuantity, line.damagedQuantity, line.receivedQuantity - line.damagedQuantity, currency(line.purchasePricePaise), [...line.serials, ...(line.damagedSerials || [])].join(', ') || '—'])} /></>}
    </DetailDrawer>
  </div>
}

export function SerialScanning() {
  const { data, transact } = useDemo()
  const [grnId, setGrnId] = useState(data.grns.find(item => item.status === 'Draft')?.id || ''), [productId, setProductId] = useState(''), [serial, setSerial] = useState(''), [condition, setCondition] = useState('Sellable'), [error, setError] = useState('')
  const draftGRNs = data.grns.filter(item => item.status === 'Draft')
  const effectiveGrnId = grnId || draftGRNs[0]?.id || ''
  const grn = data.grns.find(item => item.id === effectiveGrnId && item.status === 'Draft')
  const line = grn?.items.find(item => item.productId === productId)
  const product = data.products.find(item => item.id === productId)
  const acceptedExpected = line ? Math.max(0, line.receivedQuantity - line.damagedQuantity) : 0, damagedExpected = line?.damagedQuantity || 0
  const damagedSerials = line?.damagedSerials || []
  const expected = line?.receivedQuantity || 0
  function addSerial(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); const clean = serial.trim()
    if (!grn || !line || !product?.serialRequired) { setError('Choose a draft GRN and a serial-controlled product.'); return }
    if (!clean) { setError('Enter or scan a serial number.'); return }
    if (data.serials.some(item => item.serial.toLowerCase() === clean.toLowerCase()) || grn.items.some(item => [...item.serials, ...(item.damagedSerials || [])].some(value => value.toLowerCase() === clean.toLowerCase()))) { setError('This serial number is already registered or scanned.'); return }
    const targetCount = condition === 'Damaged' ? damagedSerials.length : line.serials.length, targetExpected = condition === 'Damaged' ? damagedExpected : acceptedExpected
    if (targetCount >= targetExpected) { setError(`The expected ${condition.toLowerCase()} serial count of ${targetExpected} has already been reached.`); return }
    try {
      transact(current => ({
        ...current, grns: current.grns.map(item => {
          if (item.id !== grn.id) return item
          return {
            ...item, items: item.items.map(row => {
              if (row.productId !== product.id) return row
              return condition === 'Damaged' ? { ...row, damagedSerials: [...(row.damagedSerials || []), clean] } : { ...row, serials: [...row.serials, clean] }
            })
          }
        })
      }))
      toast.success('Serial added to GRN draft'); setSerial(''); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Serial could not be added.') }
  }
  const eligible = grn?.items.filter(item => data.products.find(product => product.id === item.productId)?.serialRequired) || []
  return <div className="phase">
    <PageHeader eyebrow="Warehouse / Intake" title="Serial scanning" description="Scan or type serials into a draft GRN. This is keyboard text entry; no scanner hardware or stock mutation is involved." />
    <div className="p4-scan-grid">
      <Panel title="GRN intake" meta="Scanned serials remain in the draft until receipt confirmation">
        <div className="crm-form-grid">
          <SelectField label="Draft GRN" value={effectiveGrnId} onChange={value => { setGrnId(value); setProductId('') }} options={draftGRNs.map(item => ({ value: item.id, label: `${item.id} · ${item.supplier}` }))} />
          <SelectField label="Serialized product" value={productId} onChange={setProductId} options={[{ value: '', label: 'Select a product' }, ...(eligible || []).map(item => ({ value: item.productId, label: data.products.find(product => product.id === item.productId)?.name || item.productId }))]} />
        </div>
        {grn && line && <div className="p4-scan-progress"><div><span>Expected / scanned sellable</span><strong>{acceptedExpected} / {line.serials.length}</strong></div><div><span>Expected / scanned damaged</span><strong>{damagedExpected} / {damagedSerials.length}</strong></div><div><span>Unscanned</span><strong>{Math.max(0, expected - line.serials.length - damagedSerials.length)}</strong></div></div>}
        <form className="crm-form" onSubmit={addSerial}><SelectField label="Serial condition" value={condition} onChange={setCondition} options={[{ value: 'Sellable', label: 'Sellable' }, { value: 'Damaged', label: 'Damaged' }]} /><ScanField label="Serial number" value={serial} onChange={setSerial} placeholder="Focus the field and scan or type a serial" onScan={() => addSerial()} disabled={!grn || !line} />{error && <p role="alert" className="crm-error">{error}</p>}<Button type="submit" disabled={!grn || !line}>Add serial</Button></form>
      </Panel>
      <Panel title="Current scan list" meta={line ? `${line.serials.length} scanned · ${Math.max(0, expected - line.serials.length)} to go` : 'Select a product'}>
        {line && (line.serials.length + damagedSerials.length) > 0 ? <DataTable columns={['#', 'Serial number', 'Receipt condition']} rows={[...line.serials.map((value, index) => [index + 1, value, 'Sellable']), ...damagedSerials.map((value, index) => [line.serials.length + index + 1, value, 'Damaged'])]} /> : <EmptyState text="No serials have been scanned into this GRN line." />}
      </Panel>
    </div>
    <p className="crm-note">For serialized GRN lines, scanned count must equal received quantity less damaged quantity before the receipt can be confirmed.</p>
  </div>
}

type PutawayDraft = { productId: string; storeId: string; quantity: string; serials: string }
const freshPutaway = (): PutawayDraft => ({ productId: '', storeId: '', quantity: '', serials: '' })
export function WarehouseOperations() {
  const { data, transact } = useDemo()
  const [putaway, setPutaway] = useState(false), [draft, setDraft] = useState<PutawayDraft>(freshPutaway()), [error, setError] = useState('')
  const pendingGRNs = data.grns.filter(item => item.status === 'Draft'), warehouseRows = data.inventory.filter(item => item.storeId === warehouseLocationId && item.quantity > 0)
  const damaged = data.grns.reduce((sum, grn) => sum + grn.items.reduce((total, line) => total + line.damagedQuantity, 0), 0)
  const transit = data.transfers.filter(item => item.status === 'Dispatched' || item.status === 'Partially Received').length
  const product = data.products.find(item => item.id === draft.productId), warehouseQty = product ? onHand(data.inventory, product.id, warehouseLocationId) : 0
  function applyPutaway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const qty = Number(draft.quantity), serials = serialList(draft.serials)
    if (!product || !draft.storeId || !Number.isInteger(qty) || qty < 1 || qty > warehouseQty) { setError(`Enter a whole quantity from 1 to ${warehouseQty}.`); return }
    if (product.serialRequired && (serials.length !== qty || new Set(serials).size !== qty)) { setError(`Enter exactly ${qty} distinct available serials from the warehouse.`); return }
    try {
      transact(current => {
        const source = current.inventory.find(item => item.productId === product.id && item.storeId === warehouseLocationId), destination = current.inventory.find(item => item.productId === product.id && item.storeId === draft.storeId)
        if (!source || !destination || source.quantity < qty) throw new Error('Warehouse or destination stock changed. No movement was recorded.')
        if (product.serialRequired && serials.some(value => !current.serials.some(item => item.serial === value && item.productId === product.id && item.storeId === warehouseLocationId && item.status === 'Available'))) throw new Error('One or more selected serials are no longer available in the warehouse.')
        const now = new Date().toISOString(), reference = `PUT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
        const movementRows: InventoryMovement[] = (product.serialRequired ? serials : ['']).map(serial => ({ id: crypto.randomUUID(), reference, productId: product.id, sku: product.sku, serial, fromLocation: warehouseLocationId, toLocation: draft.storeId, quantity: product.serialRequired ? 1 : qty, type: 'Putaway', date: now, actor: 'Prince Tiwari', reason: 'Warehouse putaway' }))
        return {
          ...current,
          inventory: current.inventory.map(row => row === source ? { ...row, quantity: row.quantity - qty } : row === destination ? { ...row, quantity: row.quantity + qty } : row),
          serials: current.serials.map(item => serials.includes(item.serial) ? { ...item, storeId: draft.storeId, status: 'Available' } : item),
          movements: [...current.movements, ...movementRows],
          audit: [...current.audit, { id: crypto.randomUUID(), date: now, action: 'Warehouse putaway', actor: 'Prince Tiwari', reference, detail: `${product.name} · ${qty} · ${draft.storeId}` }]
        }
      })
      toast.success('Warehouse putaway recorded'); setPutaway(false); setDraft(freshPutaway())
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Putaway failed. No stock was moved.') }
  }
  return <div className="phase">
    <PageHeader eyebrow="Warehouse / Daily work" title="Warehouse operations" description="Prioritize intake, pending serial checks, putaway, damage and transfer dispatch." />
    <div className="p4-metrics"><article><span>Incoming GRNs</span><strong>{pendingGRNs.length}</strong></article><article><span>Pending serial scans</span><strong>{pendingGRNs.reduce((sum, grn) => sum + grn.items.reduce((total, line) => { const product = data.products.find(item => item.id === line.productId); return total + (product?.serialRequired ? Math.max(0, line.receivedQuantity - line.damagedQuantity - line.serials.length) : 0) }, 0), 0)}</strong></article><article><span>Stock awaiting putaway</span><strong>{warehouseRows.reduce((sum, row) => sum + row.quantity, 0)}</strong></article><article><span>Available warehouse stock</span><strong>{warehouseRows.reduce((sum, row) => sum + row.quantity, 0)}</strong></article><article><span>Damaged units</span><strong>{damaged}</strong></article><article><span>Pending transfers</span><strong>{transit}</strong></article></div>
    <Panel title="Warehouse stock" meta={`${warehouseRows.length} product lines · available after confirmed receipt`}>
      <div className="p4-action-row"><span>{warehouseLocationName}</span><Button onClick={() => { setDraft(freshPutaway()); setError(''); setPutaway(true) }} disabled={!warehouseRows.length}>Put away stock</Button></div>
      {warehouseRows.length ? <DataTable columns={['Product', 'SKU', 'Type', 'Available', 'Unit purchase cost', 'Stock value', 'Serials']} rows={warehouseRows.map(row => { const item = data.products.find(product => product.id === row.productId)!; const serialCount = data.serials.filter(serial => serial.productId === item.id && serial.storeId === warehouseLocationId && serial.status === 'Available').length; return [item.name, item.sku, item.serialRequired ? 'Serialized' : 'Quantity-based', row.quantity, currency(item.purchasePricePaise), currency(item.purchasePricePaise * row.quantity), item.serialRequired ? serialCount : '—'] })} /> : <EmptyState text="No stock is currently held in the central warehouse. Confirm a GRN to receive inventory." />}
    </Panel>
    <Panel title="Recent warehouse movements" meta="Latest entries that touch the central warehouse">
      <DataTable columns={['Date', 'Movement', 'Reference', 'Product', 'Quantity', 'From', 'To', 'Reason']} rows={[...data.movements].filter(item => item.fromLocation === warehouseLocationId || item.toLocation === warehouseLocationId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map(item => [new Date(item.date).toLocaleString('en-IN'), item.type, item.reference, data.products.find(product => product.id === item.productId)?.name || item.productId, item.quantity, locationName(item.fromLocation, data.stores), locationName(item.toLocation, data.stores), item.reason])} />
    </Panel>
    <Dialog open={putaway} onOpenChange={setPutaway}><DialogContent className="crm-dialog"><DialogTitle>Put away warehouse stock</DialogTitle><DialogDescription>Moves existing warehouse stock to a store. This is not a new receipt.</DialogDescription><form className="crm-form" onSubmit={applyPutaway} noValidate><div className="crm-form-grid">
      <SelectField label="Product" value={draft.productId} onChange={value => setDraft(current => ({ ...current, productId: value, quantity: '', serials: '' }))} options={[{ value: '', label: 'Select product' }, ...warehouseRows.map(row => { const item = data.products.find(product => product.id === row.productId)!; return { value: item.id, label: `${item.name} · ${row.quantity} available` } })]} />
      <SelectField label="Destination store" value={draft.storeId} onChange={value => setDraft(current => ({ ...current, storeId: value }))} options={data.stores.map(item => ({ value: item.id, label: item.name }))} />
      <Field label={`Quantity to put away (${warehouseQty} available)`} value={draft.quantity} onChange={value => setDraft(current => ({ ...current, quantity: value }))} type="number" step="1" />
      {product?.serialRequired && <Field label="Serials to put away" value={draft.serials} onChange={value => setDraft(current => ({ ...current, serials: value }))} placeholder="Comma or space separated" />}
    </div>{error && <p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => setPutaway(false)}>Cancel</Button><Button type="submit">Confirm putaway</Button></DialogFooter></form></DialogContent></Dialog>
  </div>
}

type BuybackDraft = { customerId: string; productId: string; storeId: string; condition: string; serial: string; estimatedValue: string; notes: string }
const freshBuyback = (): BuybackDraft => ({ customerId: '', productId: '', storeId: '', condition: 'Good', serial: '', estimatedValue: '', notes: '' })
export function BuybackManagement() {
  const { data, transact } = useDemo()
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<BuybackDraft>(freshBuyback()), [error, setError] = useState(''), [target, setTarget] = useState<string>(''), [reject, setReject] = useState<string>(''), [decision, setDecision] = useState<{ id: string; disposition: 'Resale stock' | 'Scrapped' } | null>(null)
  const product = data.products.find(item => item.id === draft.productId)
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const value = parsePaise(draft.estimatedValue)
    if (!draft.customerId || !product || !draft.storeId || !Number.isFinite(value) || value <= 0 || product.serialRequired && !draft.serial.trim()) { setError('Complete the customer, product, location, condition, estimated value and required serial details.'); return }
    if (draft.serial && data.serials.some(item => item.serial === draft.serial.trim() && item.status !== 'Sold' && item.status !== 'Returned')) { setError('This serial is already recorded and is not an eligible sold unit.'); return }
    if (data.buybacks.some(item => item.serial && item.serial === draft.serial.trim() && item.status !== 'Rejected' && item.disposition === 'Pending inspection')) { setError('An open buyback already exists for this serial.'); return }
    const currentSerial = data.serials.find(item => item.serial === draft.serial.trim())
    if (currentSerial && currentSerial.productId !== product.id) { setError('The serial belongs to a different product.'); return }
    try {
      transact(current => ({ ...current, buybacks: [...current.buybacks, { id: `BB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, customerId: draft.customerId, productId: product.id, storeId: draft.storeId, condition: draft.condition, serial: draft.serial.trim(), estimatedValuePaise: value, approvedValuePaise: 0, exchangeCreditPaise: 0, status: 'Pending Approval', disposition: 'Pending inspection', createdAt: new Date().toISOString(), createdBy: 'Prince Tiwari', notes: draft.notes.trim() }] }))
      toast.success('Buyback assessment created'); setOpen(false); setDraft(freshBuyback())
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Buyback assessment could not be created.') }
  }
  function approve(id: string) {
    try {
      transact(current => ({ ...current, buybacks: current.buybacks.map(item => item.id === id && item.status === 'Pending Approval' ? { ...item, status: 'Approved', approvedValuePaise: item.estimatedValuePaise, exchangeCreditPaise: item.estimatedValuePaise } : item), audit: [...current.audit, { id: crypto.randomUUID(), date: new Date().toISOString(), action: 'Buyback approved', actor: 'Prince Tiwari', reference: id, detail: 'Approved at estimated demo value' }] }))
      toast.success('Buyback approved at the estimated demo value'); setTarget('')
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Buyback approval failed.') }
  }
  function decide(id: string, disposition: 'Resale stock' | 'Scrapped') {
    try {
      transact(current => {
        const buyback = current.buybacks.find(item => item.id === id && item.status === 'Approved' && item.disposition === 'Pending inspection')
        if (!buyback) throw new Error('Only an approved, unprocessed buyback can be dispositioned.')
        const item = current.products.find(product => product.id === buyback.productId)
        const stock = current.inventory.find(row => row.productId === buyback.productId && row.storeId === buyback.storeId)
        if (!item || !stock) throw new Error('Product or inventory location is unavailable.')
        const now = new Date().toISOString(), serial = buyback.serial.trim()
        const existing = current.serials.find(row => row.serial === serial)
        if (existing && existing.status !== 'Sold' && existing.status !== 'Returned') throw new Error('Serial is not in a state eligible for approved buyback.')
        if (disposition === 'Resale stock' && ['Damaged', 'Parts only', 'Scrap'].includes(buyback.condition)) throw new Error('This condition is not eligible for resale. Choose scrap disposition.')
        const idRef = `${buyback.id}-${disposition === 'Resale stock' ? 'STOCK' : 'SCRAP'}`
        const baseMovement: InventoryMovement = { id: crypto.randomUUID(), reference: buyback.id, productId: item.id, sku: item.sku, serial: item.serialRequired ? serial : '', fromLocation: 'CUSTOMER', toLocation: buyback.storeId, quantity: 1, type: 'Buyback', date: now, actor: 'Prince Tiwari', reason: `Approved buyback · ${buyback.condition} · exchange credit ${currency(buyback.exchangeCreditPaise)}` }
        const scrapMovement: InventoryMovement = { ...baseMovement, id: crypto.randomUUID(), reference: idRef, fromLocation: buyback.storeId, toLocation: '', type: 'Scrap', reason: 'Approved buyback disposition to scrap' }
        const nextSerial = existing ? { ...existing, storeId: buyback.storeId, status: disposition === 'Resale stock' ? 'Available' as const : 'Scrapped' as const, invoiceId: undefined, purchaseDate: now } : item.serialRequired ? { serial, productId: item.id, storeId: buyback.storeId, status: disposition === 'Resale stock' ? 'Available' as const : 'Scrapped' as const, purchaseDate: now } : null
        return {
          ...current,
          buybacks: current.buybacks.map(row => row.id === buyback.id ? { ...row, disposition } : row),
          inventory: disposition === 'Resale stock' ? current.inventory.map(row => row === stock ? { ...row, quantity: row.quantity + 1 } : row) : current.inventory,
          serials: nextSerial ? existing ? current.serials.map(row => row.serial === serial ? nextSerial : row) : [...current.serials, nextSerial] : current.serials,
          movements: [...current.movements, baseMovement, ...(disposition === 'Scrapped' ? [scrapMovement] : [])],
          audit: [...current.audit, { id: crypto.randomUUID(), date: now, action: `Buyback ${disposition.toLowerCase()}`, actor: 'Prince Tiwari', reference: buyback.id, detail: `${item.name} · ${buyback.condition}` }]
        }
      })
      toast.success(disposition === 'Resale stock' ? 'Buyback added to available stock' : 'Buyback item marked scrapped')
      setDecision(null)
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Buyback disposition failed.') }
  }
  function rejectBuyback(id: string) {
    transact(current => ({ ...current, buybacks: current.buybacks.map(item => item.id === id && item.status === 'Pending Approval' ? { ...item, status: 'Rejected' } : item), audit: [...current.audit, { id: crypto.randomUUID(), date: new Date().toISOString(), action: 'Buyback rejected', actor: 'Prince Tiwari', reference: id, detail: 'Assessment rejected' }] }))
    toast.success('Buyback assessment rejected'); setReject('')
  }
  return <div className="phase">
    <PageHeader eyebrow="Warehouse / Returns" title="Buyback & scrap" description="Assess customer buybacks, approve value, then explicitly confirm resale or scrap disposition."><Button onClick={() => { setDraft(freshBuyback()); setError(''); setOpen(true) }}>New buyback</Button></PageHeader>
    <Panel title="Buyback assessments" meta="Acquired units remain outside sellable stock until an approved disposition is recorded.">
      {data.buybacks.length ? <DataTable columns={['Reference', 'Customer', 'Product', 'Store', 'Condition', 'Serial', 'Estimated', 'Approved', 'Exchange credit', 'Approval', 'Disposition', 'Actions']} rows={[...data.buybacks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(item => {
        const product = data.products.find(row => row.id === item.productId)
        return [item.id, data.customers.find(customer => customer.id === item.customerId)?.name || item.customerId, product?.name || item.productId, locationName(item.storeId, data.stores), item.condition, item.serial || 'Not applicable', currency(item.estimatedValuePaise), item.approvedValuePaise ? currency(item.approvedValuePaise) : '—', item.exchangeCreditPaise ? currency(item.exchangeCreditPaise) : '—', item.status, item.disposition,
        <div className="rowlinks" key={item.id + 'actions'}>{item.status === 'Pending Approval' && <><button onClick={() => setTarget(item.id)}>Approve</button><button onClick={() => setReject(item.id)}>Reject</button></>}{item.status === 'Approved' && item.disposition === 'Pending inspection' && <><button onClick={() => setDecision({ id: item.id, disposition: 'Resale stock' })}>Mark resale-ready</button><button onClick={() => setDecision({ id: item.id, disposition: 'Scrapped' })}>Mark scrapped</button></>}</div>]
      })} /> : <EmptyState text="No buyback assessments have been recorded." />}
    </Panel>
    <Panel title="Scrap register" meta="Stock is reduced only after manager approval and availability checks."><ScrapRegister /></Panel>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="crm-dialog"><DialogTitle>New buyback assessment</DialogTitle><DialogDescription>Assessment does not add stock. Approval and disposition are separate explicit actions.</DialogDescription>
      <form className="crm-form" onSubmit={create} noValidate><div className="crm-form-grid">
        <SelectField label="Customer" value={draft.customerId} onChange={value => setDraft(current => ({ ...current, customerId: value }))} options={[{ value: '', label: 'Select customer' }, ...data.customers.filter(item => item.status === 'Active').map(item => ({ value: item.id, label: `${item.name} · ${item.mobile}` }))]} />
        <SelectField label="Product" value={draft.productId} onChange={value => setDraft(current => ({ ...current, productId: value, serial: '' }))} options={[{ value: '', label: 'Select product' }, ...data.products.map(item => ({ value: item.id, label: `${item.name} · ${item.sku}` }))]} />
        <SelectField label="Store" value={draft.storeId} onChange={value => setDraft(current => ({ ...current, storeId: value }))} options={data.stores.map(item => ({ value: item.id, label: item.name }))} />
        <SelectField label="Product condition" value={draft.condition} onChange={value => setDraft(current => ({ ...current, condition: value }))} options={['Excellent', 'Good', 'Fair', 'Damaged', 'Parts only', 'Scrap'].map(value => ({ value, label: value }))} />
        {product?.serialRequired && <Field label="Product serial number" value={draft.serial} onChange={value => setDraft(current => ({ ...current, serial: value }))} />}
        <Field label="Estimated value (₹)" value={draft.estimatedValue} onChange={value => setDraft(current => ({ ...current, estimatedValue: value }))} type="number" step="0.01" />
        <Field label="Assessment notes" value={draft.notes} onChange={value => setDraft(current => ({ ...current, notes: value }))} required={false} />
      </div>{error && <p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save assessment</Button></DialogFooter></form>
    </DialogContent></Dialog>
    <Confirmation open={!!target} title="Approve buyback assessment?" text="The estimated value will be recorded as the approved demo exchange credit. Stock is not available until disposition." onClose={() => setTarget('')} onConfirm={() => approve(target)} />
    <Confirmation open={!!reject} title="Reject this buyback?" text="The assessment remains in the audit history and no stock is added." onClose={() => setReject('')} onConfirm={() => rejectBuyback(reject)} />
    <Confirmation open={!!decision} title={`Confirm ${decision?.disposition === 'Scrapped' ? 'scrap' : 'resale'} disposition?`} text="This approved buyback will be recorded in the stock ledger. Resale stock becomes sellable only after this confirmation." onClose={() => setDecision(null)} onConfirm={() => decision && decide(decision.id, decision.disposition)} />
  </div>
}

type ScrapDraft = { productId: string; storeId: string; quantity: string; serials: string; reason: string }
const freshScrap = (): ScrapDraft => ({ productId: '', storeId: '', quantity: '', serials: '', reason: '' })
function ScrapRegister() {
  const { data, transact } = useDemo()
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<ScrapDraft>(freshScrap()), [error, setError] = useState(''), [approveId, setApproveId] = useState(''), [approvalCode, setApprovalCode] = useState(''), [rejectId, setRejectId] = useState('')
  const product = data.products.find(item => item.id === draft.productId), qty = product && draft.storeId ? onHand(data.inventory, product.id, draft.storeId) : 0
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    const quantity = Number(draft.quantity), serials = serialList(draft.serials)
    if (!product || !draft.storeId || !Number.isInteger(quantity) || quantity < 1 || quantity > qty || draft.reason.trim().length < 5) { setError(`Enter a valid product, location, quantity from 1 to ${qty}, and a scrap reason of at least five characters.`); return }
    if (product.serialRequired && (serials.length !== quantity || new Set(serials).size !== quantity)) { setError(`Enter exactly ${quantity} distinct serial numbers.`); return }
    if (product.serialRequired && serials.some(serial => !data.serials.some(item => item.serial === serial && item.productId === product.id && item.storeId === draft.storeId && item.status === 'Available'))) { setError('Only available serials at this location can be submitted for scrap.'); return }
    try {
      transact(current => ({ ...current, scrapRequests: [...current.scrapRequests, { id: `SCR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, productId: product.id, storeId: draft.storeId, quantity, serials, reason: draft.reason.trim(), status: 'Pending Approval', date: new Date().toISOString(), actor: 'Prince Tiwari' }] }))
      toast.success('Scrap request submitted for approval'); setOpen(false); setDraft(freshScrap())
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Scrap request could not be created.') }
  }
  function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (approvalCode !== 'SCRAP-APPROVED') { setError('Enter the demo approval code SCRAP-APPROVED.'); return }
    try {
      transact(current => {
        const request = current.scrapRequests.find(item => item.id === approveId && item.status === 'Pending Approval')
        if (!request) throw new Error('This scrap request is no longer awaiting approval.')
        const row = current.inventory.find(item => item.productId === request.productId && item.storeId === request.storeId)
        const item = current.products.find(product => product.id === request.productId)
        if (!row || !item || row.quantity < request.quantity) throw new Error('Available stock changed. Scrap was not approved.')
        if (item.serialRequired && request.serials.some(serial => !current.serials.some(record => record.serial === serial && record.status === 'Available' && record.storeId === request.storeId))) throw new Error('One or more serials are no longer available. Scrap was not approved.')
        const now = new Date().toISOString(), movements: InventoryMovement[] = (item.serialRequired ? request.serials : ['']).map(serial => ({ id: crypto.randomUUID(), reference: request.id, productId: item.id, sku: item.sku, serial, fromLocation: request.storeId, toLocation: '', quantity: item.serialRequired ? 1 : request.quantity, type: 'Scrap', date: now, actor: 'Prince Tiwari', reason: request.reason }))
        return {
          ...current,
          scrapRequests: current.scrapRequests.map(record => record.id === request.id ? { ...record, status: 'Approved' } : record),
          inventory: current.inventory.map(record => record === row ? { ...record, quantity: record.quantity - request.quantity } : record),
          serials: current.serials.map(record => request.serials.includes(record.serial) ? { ...record, status: 'Scrapped' } : record),
          movements: [...current.movements, ...movements],
          audit: [...current.audit, { id: crypto.randomUUID(), date: now, action: 'Stock scrapped', actor: 'Prince Tiwari', reference: request.id, detail: request.reason }]
        }
      })
      toast.success('Scrap approved; stock and serial status updated'); setApproveId(''); setApprovalCode(''); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Scrap approval failed. No stock was changed.') }
  }
  function reject(id: string) {
    try {
      transact(current => {
        if (!current.scrapRequests.some(item => item.id === id && item.status === 'Pending Approval')) throw new Error('This scrap request is no longer awaiting approval.')
        return { ...current, scrapRequests: current.scrapRequests.map(item => item.id === id ? { ...item, status: 'Rejected' } : item), audit: [...current.audit, { id: crypto.randomUUID(), date: new Date().toISOString(), action: 'Scrap rejected', actor: 'Prince Tiwari', reference: id, detail: 'Approval rejected' }] }
      })
      toast.success('Scrap request rejected')
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Scrap request could not be rejected.') }
  }
  const rows = [...data.scrapRequests].sort((a, b) => b.date.localeCompare(a.date))
  return <>
    <div className="p4-action-row"><span>{rows.length} scrap requests recorded</span><Button onClick={() => { setDraft(freshScrap()); setError(''); setOpen(true) }}>New scrap request</Button></div>
    {rows.length ? <DataTable columns={['Reference', 'Product', 'Serial / quantity', 'Location', 'Reason', 'Date', 'Status', 'Actions']} rows={rows.map(item => [item.id, data.products.find(product => product.id === item.productId)?.name || item.productId, item.serials.join(', ') || item.quantity, locationName(item.storeId, data.stores), item.reason, new Date(item.date).toLocaleDateString('en-IN'), item.status, <div className="rowlinks" key={item.id + 'actions'}>{item.status === 'Pending Approval' && <><button onClick={() => { setApproveId(item.id); setApprovalCode(''); setError('') }}>Approve</button><button onClick={() => setRejectId(item.id)}>Reject</button></>}</div>])} /> : <EmptyState text="No scrap requests have been recorded." />}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="crm-dialog"><DialogTitle>New scrap request</DialogTitle><DialogDescription>Stock remains available until an authorized approval is confirmed.</DialogDescription><form className="crm-form" onSubmit={create} noValidate><div className="crm-form-grid">
      <SelectField label="Product" value={draft.productId} onChange={value => setDraft(current => ({ ...current, productId: value, serials: '' }))} options={[{ value: '', label: 'Select product' }, ...data.products.map(item => ({ value: item.id, label: `${item.name} · ${item.sku}` }))]} />
      <SelectField label="Store or warehouse" value={draft.storeId} onChange={value => setDraft(current => ({ ...current, storeId: value }))} options={locations(data.stores)} />
      <Field label={`Quantity to scrap (${qty} available)`} value={draft.quantity} onChange={value => setDraft(current => ({ ...current, quantity: value }))} type="number" step="1" />
      {product?.serialRequired && <Field label="Serial numbers to scrap" value={draft.serials} onChange={value => setDraft(current => ({ ...current, serials: value }))} placeholder="Comma or space separated" />}
      <Field label="Scrap reason" value={draft.reason} onChange={value => setDraft(current => ({ ...current, reason: value }))} />
    </div>{error && <p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Submit for approval</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={!!approveId} onOpenChange={open => { if (!open) { setApproveId(''); setError('') } }}><DialogContent><DialogTitle>Approve scrap request?</DialogTitle><DialogDescription>Enter the simulated authorization code. Approval permanently reduces available stock and records ledger movements.</DialogDescription><form className="crm-form" onSubmit={approve}><Field label="Approval code" value={approvalCode} onChange={setApprovalCode} />{error && <p role="alert" className="crm-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => setApproveId('')}>Cancel</Button><Button type="submit">Confirm scrap approval</Button></DialogFooter></form></DialogContent></Dialog>
    <Confirmation open={!!rejectId} title="Reject this scrap request?" text="The rejection is retained in the audit history. No inventory quantity will change." onClose={() => setRejectId('')} onConfirm={() => { reject(rejectId); setRejectId('') }} />
  </>
}
